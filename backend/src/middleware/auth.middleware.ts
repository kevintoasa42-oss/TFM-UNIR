import { ApplicationError } from "../errors.ts";
import { readSessionToken } from "../http/session-cookie.ts";
import type { AuthUser, Persistence } from "../persistence.ts";
import { findSessionUser } from "../services/session.service.ts";

export function currentUser(sessions: Persistence["sessions"], request: Request): Promise<AuthUser | null> {
  return findSessionUser(sessions, readSessionToken(request));
}

export async function requireUser(sessions: Persistence["sessions"], request: Request): Promise<AuthUser> {
  const user = await currentUser(sessions, request);
  if (!user) throw new ApplicationError(401, "Inicia sesión para continuar.");
  return user;
}

export function requireAdmin(user: AuthUser): void {
  if (user.role !== "admin") throw new ApplicationError(403, "Esta acción requiere el rol administrador.");
}
