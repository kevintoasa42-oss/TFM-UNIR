import { ApplicationError } from "../errors.ts";
import type { AuthUser, ManagedUser, Persistence, Role } from "../persistence.ts";

export function listUsers(accounts: Persistence["accounts"]): Promise<ManagedUser[]> {
  return accounts.list();
}

export async function changeUserRole(accounts: Persistence["accounts"], actor: AuthUser, targetId: string, role: Role): Promise<void> {
  if (targetId === actor.id && role === "user") {
    throw new ApplicationError(409, "No puedes quitarte el rol administrador a ti mismo.");
  }
  if (!await accounts.setRole(targetId, role)) throw new ApplicationError(409, "No se pudo cambiar ese rol.");
}
