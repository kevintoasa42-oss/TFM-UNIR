import { z } from "zod";
import { createSession, currentUser, loginSchema, passwordMatches, passwordRecord, registerSchema, requireAdmin, requireUser, revokeSession, clearSessionCookie, type AuthUser } from "./auth";
import { emptyContent, readLibrary, writeLibrary } from "./content-store";
import { body, errorResponse, HttpError, json, sameOrigin } from "./http";
import { roomView } from "../domain/room";
import { joinStoredRoom, reserveRoom } from "./room-store";
import type { Persistence } from "./persistence";

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Revisa los datos.");
  return result.data;
}

const codePattern = /^\/api\/rooms\/(\d{6})\/(join|ws)$/;

export async function api(request: Request, store: Persistence, connectRoom?: (code: string, userId: string) => Promise<Response>): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (path === "/api/health" && method === "GET") {
      const health = await store.health();
      return json(health, health.ready ? 200 : 503);
    }
    if (method !== "GET") sameOrigin(request);
    if (path === "/api/me" && method === "GET") return json({ user: await currentUser(store.sessions, request) });

    if (path === "/api/register" && method === "POST") {
      const input = parse(registerSchema, await body(request));
      const { salt, hash } = await passwordRecord(input.password);
      const id = crypto.randomUUID();
      const user = await store.accounts.create({ id, name: input.name, email: input.email, passwordHash: hash, passwordSalt: salt, createdAt: Date.now() });
      const cookie = await createSession(store.sessions, id, request);
      return json({ user }, 201, { "Set-Cookie": cookie });
    }

    if (path === "/api/login" && method === "POST") {
      const input = parse(loginSchema, await body(request));
      const record = await store.accounts.findByEmail(input.email);
      if (!record || !await passwordMatches(input.password, record.passwordSalt, record.passwordHash)) throw new HttpError(401, "Correo o contraseña incorrectos.");
      const cookie = await createSession(store.sessions, record.id, request);
      const user: AuthUser = { id: record.id, name: record.name, email: record.email, role: record.role };
      return json({ user }, 200, { "Set-Cookie": cookie });
    }

    if (path === "/api/logout" && method === "POST") {
      await revokeSession(store.sessions, request);
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
    }

    const user = await requireUser(store.sessions, request);

    if (path === "/api/content" && method === "GET") {
      return json(user.role === "admin" ? await readLibrary(store.libraries, user) : { content: emptyContent(user), revision: 0 });
    }
    if (path === "/api/content" && method === "PUT") {
      requireAdmin(user);
      const input = parse(z.object({ content: z.unknown(), revision: z.number().int().min(0) }), await body(request));
      return json(await writeLibrary(store.libraries, user, input.content, input.revision));
    }
    if (path === "/api/users" && method === "GET") {
      requireAdmin(user);
      return json({ users: await store.accounts.list() });
    }
    if (path.startsWith("/api/users/") && method === "PATCH") {
      requireAdmin(user);
      const targetId = parse(z.string().uuid("La cuenta no es válida."), path.slice("/api/users/".length));
      const { role } = parse(z.object({ role: z.enum(["admin", "user"]) }), await body(request));
      if (targetId === user.id && role === "user") throw new HttpError(409, "No puedes quitarte el rol administrador a ti mismo.");
      if (!await store.accounts.setRole(targetId, role)) throw new HttpError(409, "No se pudo cambiar ese rol.");
      return json({ ok: true });
    }

    if (path === "/api/rooms" && method === "POST") {
      requireAdmin(user);
      const { examId } = parse(z.object({ examId: z.string().uuid() }), await body(request));
      const { content } = await readLibrary(store.libraries, user);
      const exam = content.exams.find((entry) => entry.id === examId);
      if (!exam) throw new HttpError(404, "El examen no existe.");
      const questions = exam.questionIds.map((id) => content.questions.find((item) => item.id === id)).filter((item) => item !== undefined);
      if (!questions.length || questions.length !== exam.questionIds.length) throw new HttpError(409, "El examen no tiene preguntas válidas.");
      const code = await reserveRoom(store.rooms, exam.name, user.id, user.name, questions);
      return json({ code }, 201);
    }

    const match = codePattern.exec(path);
    if (match?.[2] === "join" && method === "POST") {
      const result = await joinStoredRoom(store.rooms, match[1], user.id, user.name);
      if (result.error) throw new HttpError(409, result.error);
      return json({ room: roomView(result.room, user.id) });
    }
    if (match?.[2] === "ws" && method === "GET") {
      sameOrigin(request);
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") throw new HttpError(426, "Se requiere WebSocket.");
      if (!connectRoom) throw new HttpError(426, "Usa una conexión WebSocket.");
      return connectRoom(match[1], user.id);
    }
    return json({ error: "Ruta no encontrada." }, 404);
  } catch (error) { return errorResponse(error); }
}
