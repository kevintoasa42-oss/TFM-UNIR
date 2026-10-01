import { z } from "zod";
import { body, json, parse } from "../http.ts";
import { clearSessionCookie, readSessionToken, sessionCookie } from "../http/session-cookie.ts";
import { currentUser } from "../middleware/auth.middleware.ts";
import type { PublicContext } from "../routes/types.ts";
import { loginAccount, registerAccount } from "../services/auth.service.ts";
import { createSessionToken, revokeSessionToken } from "../services/session.service.ts";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(254),
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").max(128),
});
const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(80),
  role: z.enum(["admin", "user"], { errorMap: () => ({ message: "Selecciona Administrador o Usuario." }) }),
});

export async function me({ request, store }: PublicContext): Promise<Response> {
  return json({ user: await currentUser(store.sessions, request) });
}

export async function register({ request, store, passwordIterations }: PublicContext): Promise<Response> {
  const input = parse(registerSchema, await body(request));
  const user = await registerAccount(store.accounts, input, passwordIterations);
  const token = await createSessionToken(store.sessions, user.id);
  return json({ user }, 201, { "Set-Cookie": sessionCookie(token, request) });
}

export async function login({ request, store }: PublicContext): Promise<Response> {
  const input = parse(loginSchema, await body(request));
  const user = await loginAccount(store.accounts, input);
  const token = await createSessionToken(store.sessions, user.id);
  return json({ user }, 200, { "Set-Cookie": sessionCookie(token, request) });
}

export async function logout({ request, store }: PublicContext): Promise<Response> {
  await revokeSessionToken(store.sessions, readSessionToken(request));
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
