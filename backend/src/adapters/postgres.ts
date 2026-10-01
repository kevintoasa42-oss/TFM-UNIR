import type { Pool, PoolClient } from "pg";
import type { AuthUser, CredentialsUser, DocumentRecord, ManagedUser, Persistence } from "../persistence";
import { HttpError } from "../http";

async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

function document(row?: { data: unknown; revision: number }): DocumentRecord | null {
  return row ? { data: JSON.stringify(row.data), revision: row.revision } : null;
}

export function postgresPersistence(pool: Pool): Persistence {
  return {
    accounts: {
      async create(account) {
        try {
          const { id, name, email, role, passwordHash, passwordSalt, createdAt } = account;
          const result = await pool.query<AuthUser>(
            "INSERT INTO users (id, name, email, password_hash, password_salt, role, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, role",
            [id, name, email, passwordHash, passwordSalt, role, createdAt],
          );
          return result.rows[0];
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "23505") throw new HttpError(409, "Ya existe una cuenta con ese correo.");
          throw error;
        }
      },
      async findByEmail(email) {
        const result = await pool.query<CredentialsUser>('SELECT id, name, email, role, password_hash AS "passwordHash", password_salt AS "passwordSalt" FROM users WHERE email = $1', [email]);
        return result.rows[0] ?? null;
      },
      async list() {
        const result = await pool.query<ManagedUser>('SELECT id, name, email, role, created_at::double precision AS "createdAt" FROM users ORDER BY created_at ASC');
        return result.rows;
      },
      setRole: (id, role) => transaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(782354)");
        const result = await client.query("UPDATE users SET role = $1 WHERE id = $2 AND ($1 = 'admin' OR role = 'user' OR (SELECT COUNT(*) FROM users WHERE role = 'admin') > 1)", [role, id]);
        return Boolean(result.rowCount);
      }),
    },
    sessions: {
      async create(tokenHash, userId, expiresAt) {
        await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, userId, expiresAt]);
      },
      async revoke(tokenHash) { await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]); },
      async findUser(tokenHash, now) {
        const result = await pool.query<AuthUser>("SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > $2", [tokenHash, now]);
        return result.rows[0] ?? null;
      },
    },
    libraries: {
      async find(ownerId) { return document((await pool.query("SELECT data, revision FROM libraries WHERE owner_id = $1", [ownerId])).rows[0]); },
      async save(ownerId, data, revision) {
        const result = revision === 0
          ? await pool.query("INSERT INTO libraries (owner_id, data, revision) VALUES ($1, $2::jsonb, 1) ON CONFLICT (owner_id) DO NOTHING", [ownerId, data])
          : await pool.query("UPDATE libraries SET data = $1::jsonb, revision = revision + 1 WHERE owner_id = $2 AND revision = $3", [data, ownerId, revision]);
        return Boolean(result.rowCount);
      },
    },
    rooms: {
      async find(code) { return document((await pool.query("SELECT data, revision FROM rooms WHERE code = $1", [code])).rows[0]); },
      async insert(code, data, createdAt) {
        return Boolean((await pool.query("INSERT INTO rooms (code, data, revision, created_at) VALUES ($1, $2::jsonb, 0, $3) ON CONFLICT (code) DO NOTHING", [code, data, createdAt])).rowCount);
      },
      async save(code, data, revision) {
        return Boolean((await pool.query("UPDATE rooms SET data = $1::jsonb, revision = revision + 1 WHERE code = $2 AND revision = $3", [data, code, revision])).rowCount);
      },
      async purgeBefore(timestamp) { await pool.query("DELETE FROM rooms WHERE created_at < $1", [timestamp]); },
    },
    async health() {
      const result = await pool.query<{ rooms: string | null }>("SELECT to_regclass('public.rooms')::text AS rooms");
      const rooms = Boolean(result.rows[0]?.rooms);
      return { ready: rooms, database: true, rooms };
    },
  };
}
