import { z } from "zod";
import { createSession, currentUser, loginSchema, passwordMatches, passwordRecord, registerSchema, requireAdmin, requireUser, revokeSession, clearSessionCookie, type AuthUser, type Role } from "./auth";
import { emptyContent, readLibrary, writeLibrary } from "./content-store";
import { body, database, errorResponse, HttpError, json, sameOrigin } from "./http";

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Revisa los datos.");
  return result.data;
}

function roomStub(env: Cloudflare.Env, code: string): DurableObjectStub {
  if (!env.ROOMS) throw new HttpError(503, "Las salas en tiempo real no están disponibles.");
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

const codePattern = /^\/api\/rooms\/(\d{6})\/(join|ws)$/;

export async function api(request: Request, env: Cloudflare.Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method !== "GET") sameOrigin(request);
    const db = database(env);

    if (path === "/api/me" && method === "GET") return json({ user: await currentUser(db, request) });

    if (path === "/api/register" && method === "POST") {
      const input = parse(registerSchema, await body(request));
      const { salt, hash } = await passwordRecord(input.password);
      const id = crypto.randomUUID();
      try {
        await db.batch([
          db.prepare("INSERT INTO users (id, name, email, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?, 'user', ?)").bind(id, input.name, input.email, hash, salt, Date.now()),
          db.prepare("INSERT OR IGNORE INTO bootstrap (id, user_id) VALUES (1, ?)").bind(id),
          db.prepare("UPDATE users SET role = 'admin' WHERE id = (SELECT user_id FROM bootstrap WHERE id = 1)"),
        ]);
      } catch (error) {
        if (String(error).includes("UNIQUE")) throw new HttpError(409, "Ya existe una cuenta con ese correo.");
        throw error;
      }
      const user = await db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").bind(id).first<AuthUser>();
      if (!user) throw new HttpError(500, "No se pudo crear la cuenta.");
      const cookie = await createSession(db, id, request);
      return json({ user }, 201, { "Set-Cookie": cookie });
    }

    if (path === "/api/login" && method === "POST") {
      const input = parse(loginSchema, await body(request));
      const record = await db.prepare("SELECT id, name, email, role, password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE email = ?")
        .bind(input.email).first<AuthUser & { passwordHash: string; passwordSalt: string }>();
      if (!record || !await passwordMatches(input.password, record.passwordSalt, record.passwordHash)) throw new HttpError(401, "Correo o contraseña incorrectos.");
      const cookie = await createSession(db, record.id, request);
      const user: AuthUser = { id: record.id, name: record.name, email: record.email, role: record.role };
      return json({ user }, 200, { "Set-Cookie": cookie });
    }

    if (path === "/api/logout" && method === "POST") {
      await revokeSession(db, request);
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
    }

    const user = await requireUser(db, request);

    if (path === "/api/content" && method === "GET") {
      return json(user.role === "admin" ? await readLibrary(db, user) : { content: emptyContent(user), revision: 0 });
    }
    if (path === "/api/content" && method === "PUT") {
      requireAdmin(user);
      const input = parse(z.object({ content: z.unknown(), revision: z.number().int().min(0) }), await body(request));
      return json(await writeLibrary(db, user, input.content, input.revision));
    }
    if (path === "/api/users" && method === "GET") {
      requireAdmin(user);
      const rows = await db.prepare("SELECT id, name, email, role, created_at AS createdAt FROM users ORDER BY created_at ASC").all();
      return json({ users: rows.results });
    }
    if (path.startsWith("/api/users/") && method === "PATCH") {
      requireAdmin(user);
      const targetId = path.slice("/api/users/".length);
      const { role } = parse(z.object({ role: z.enum(["admin", "user"]) }), await body(request));
      if (targetId === user.id && role === "user") throw new HttpError(409, "No puedes quitarte el rol administrador a ti mismo.");
      const result = await db.prepare("UPDATE users SET role = ? WHERE id = ? AND (? = 'admin' OR role = 'user' OR (SELECT COUNT(*) FROM users WHERE role = 'admin') > 1)")
        .bind(role, targetId, role).run();
      if (!result.meta.changes) throw new HttpError(409, "No se pudo cambiar ese rol.");
      return json({ ok: true });
    }

    if (path === "/api/rooms" && method === "POST") {
      requireAdmin(user);
      const { examId } = parse(z.object({ examId: z.string().uuid() }), await body(request));
      const { content } = await readLibrary(db, user);
      const exam = content.exams.find((entry) => entry.id === examId);
      if (!exam) throw new HttpError(404, "El examen no existe.");
      const questions = exam.questionIds.map((id) => content.questions.find((item) => item.id === id)).filter((item) => item !== undefined);
      if (!questions.length || questions.length !== exam.questionIds.length) throw new HttpError(409, "El examen no tiene preguntas válidas.");
      for (let attempt = 0; attempt < 12; attempt++) {
        const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
        const result = await roomStub(env, code).fetch("https://room.internal/init", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, examName: exam.name, hostId: user.id, hostName: user.name, questions }) });
        if (result.status === 201) return json({ code }, 201);
        if (result.status !== 409) throw new HttpError(503, "No se pudo crear la sala.");
      }
      throw new HttpError(503, "No se encontró un código libre. Intenta otra vez.");
    }

    const match = codePattern.exec(path);
    if (match?.[2] === "join" && method === "POST") {
      const result = await roomStub(env, match[1]).fetch("https://room.internal/join", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, name: user.name }) });
      return new Response(result.body, { status: result.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (match?.[2] === "ws" && method === "GET") {
      sameOrigin(request);
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") throw new HttpError(426, "Se requiere WebSocket.");
      return roomStub(env, match[1]).fetch(`https://room.internal/connect?userId=${encodeURIComponent(user.id)}`, { headers: { Upgrade: "websocket" } });
    }
    return json({ error: "Ruta no encontrada." }, 404);
  } catch (error) { return errorResponse(error); }
}
