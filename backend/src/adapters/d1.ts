import type { AuthUser, CredentialsUser, DocumentRecord, ManagedUser, Persistence } from "../persistence";
import { HttpError } from "../http";

export function d1Persistence(db: D1Database): Persistence {
  return {
    accounts: {
      async create(account) {
        const { id, name, email, role, passwordHash, passwordSalt, createdAt } = account;
        try {
          await db.prepare("INSERT INTO users (id, name, email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(id, name, email, passwordHash, passwordSalt, role, createdAt).run();
        } catch (error) {
          if (String(error).includes("UNIQUE")) throw new HttpError(409, "Ya existe una cuenta con ese correo.");
          throw error;
        }
        const user = await db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").bind(id).first<AuthUser>();
        if (!user) throw new HttpError(500, "No se pudo crear la cuenta.");
        return user;
      },
      findByEmail: (email) => db.prepare("SELECT id, name, email, role, password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE email = ?").bind(email).first<CredentialsUser>(),
      async list() {
        return (await db.prepare("SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at ASC").all<ManagedUser>()).results;
      },
      async setRole(id, role) {
        const result = await db.prepare("UPDATE users SET role = ? WHERE id = ? AND (? = 'admin' OR role = 'user' OR (SELECT COUNT(*) FROM users WHERE role = 'admin') > 1)").bind(role, id, role).run();
        return Boolean(result.meta.changes);
      },
    },
    sessions: {
      async create(tokenHash, userId, expiresAt) {
        await db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, userId, expiresAt).run();
      },
      async revoke(tokenHash) { await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run(); },
      findUser: (tokenHash, now) => db.prepare("SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?").bind(tokenHash, now).first<AuthUser>(),
    },
    libraries: {
      find: (ownerId) => db.prepare("SELECT data, revision FROM libraries WHERE owner_id = ?").bind(ownerId).first<DocumentRecord>(),
      async save(ownerId, data, revision) {
        const result = revision === 0
          ? await db.prepare("INSERT OR IGNORE INTO libraries (owner_id, data, revision) VALUES (?, ?, 1)").bind(ownerId, data).run()
          : await db.prepare("UPDATE libraries SET data = ?, revision = revision + 1 WHERE owner_id = ? AND revision = ?").bind(data, ownerId, revision).run();
        return Boolean(result.meta.changes);
      },
    },
    rooms: {
      find: (code) => db.prepare("SELECT data, revision FROM rooms WHERE code = ?").bind(code).first<DocumentRecord>(),
      async insert(code, data, createdAt) {
        return Boolean((await db.prepare("INSERT OR IGNORE INTO rooms (code, data, revision, created_at) VALUES (?, ?, 0, ?)").bind(code, data, createdAt).run()).meta.changes);
      },
      async save(code, data, revision) {
        return Boolean((await db.prepare("UPDATE rooms SET data = ?, revision = revision + 1 WHERE code = ? AND revision = ?").bind(data, code, revision).run()).meta.changes);
      },
      async purgeBefore(timestamp) { await db.prepare("DELETE FROM rooms WHERE created_at < ?").bind(timestamp).run(); },
    },
    async health() {
      const rooms = Boolean(await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rooms'").first());
      return { ready: rooms, database: true, rooms };
    },
  };
}
