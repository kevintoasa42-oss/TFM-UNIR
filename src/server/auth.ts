import { z } from "zod";
import { HttpError } from "./http";

export type Role = "admin" | "user";
export interface AuthUser { id: string; name: string; email: string; role: Role }

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un correo válido.").max(254),
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres.").max(128),
});
export const registerSchema = credentialsSchema.extend({ name: z.string().trim().min(2, "Escribe tu nombre.").max(80) });
export const loginSchema = credentialsSchema;

const COOKIE = "fr_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function hex(bytes: Uint8Array): string { return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function fromHex(value: string): ArrayBuffer { return Uint8Array.from(value.match(/../g) ?? [], (part) => Number.parseInt(part, 16)).buffer as ArrayBuffer; }
async function digest(value: string): Promise<string> { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))); }

async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(salt), iterations: 310_000, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(result));
}

export async function passwordRecord(password: string): Promise<{ salt: string; hash: string }> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await derive(password, salt) };
}

export async function passwordMatches(password: string, salt: string, expected: string): Promise<boolean> {
  const actual = await derive(password, salt);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

export async function createSession(db: D1Database, userId: string, request: Request): Promise<string> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await digest(token), userId, Date.now() + SESSION_MS).run();
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export function clearSessionCookie(request: Request): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

function cookieToken(request: Request): string | null {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  const token = cookie?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function revokeSession(db: D1Database, request: Request): Promise<void> {
  const token = cookieToken(request);
  if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(token)).run();
}

export async function currentUser(db: D1Database, request: Request): Promise<AuthUser | null> {
  const token = cookieToken(request);
  if (!token) return null;
  const user = await db.prepare("SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .bind(await digest(token), Date.now()).first<AuthUser>();
  return user ?? null;
}

export async function requireUser(db: D1Database, request: Request): Promise<AuthUser> {
  const user = await currentUser(db, request);
  if (!user) throw new HttpError(401, "Inicia sesión para continuar.");
  return user;
}

export function requireAdmin(user: AuthUser): void {
  if (user.role !== "admin") throw new HttpError(403, "Esta acción requiere el rol administrador.");
}
