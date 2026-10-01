import type { AuthUser, Persistence } from "../persistence.ts";

export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(token: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

export async function createSessionToken(sessions: Persistence["sessions"], userId: string): Promise<string> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await sessions.create(await digest(token), userId, Date.now() + SESSION_MS);
  return token;
}

export async function findSessionUser(sessions: Persistence["sessions"], token: string | null): Promise<AuthUser | null> {
  return token ? sessions.findUser(await digest(token), Date.now()) : null;
}

export async function revokeSessionToken(sessions: Persistence["sessions"], token: string | null): Promise<void> {
  if (token) await sessions.revoke(await digest(token));
}
