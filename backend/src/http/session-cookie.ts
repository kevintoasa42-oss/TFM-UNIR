import { SESSION_MS } from "../services/session.service.ts";

const COOKIE = "fr_session";

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`));
  const token = cookie?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function sessionCookie(token: string, request: Request): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export function clearSessionCookie(request: Request): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
