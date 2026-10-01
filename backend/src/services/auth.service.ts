import { ApplicationError } from "../errors.ts";
import type { AuthUser, Persistence, Role } from "../persistence.ts";
import { passwordMatches, passwordRecord } from "../security/password.ts";
import type { PasswordIterations } from "../security/password.ts";

export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { name: string; role: Role }

export async function registerAccount(accounts: Persistence["accounts"], input: RegisterInput, iterations?: PasswordIterations): Promise<AuthUser> {
  const { salt, hash } = await passwordRecord(input.password, iterations);
  return accounts.create({
    id: crypto.randomUUID(), name: input.name, email: input.email, role: input.role,
    passwordHash: hash, passwordSalt: salt, createdAt: Date.now(),
  });
}

export async function loginAccount(accounts: Persistence["accounts"], input: LoginInput): Promise<AuthUser> {
  const record = await accounts.findByEmail(input.email);
  if (!record || !await passwordMatches(input.password, record.passwordSalt, record.passwordHash)) {
    throw new ApplicationError(401, "Correo o contraseña incorrectos.");
  }
  return { id: record.id, name: record.name, email: record.email, role: record.role };
}
