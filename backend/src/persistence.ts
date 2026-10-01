import type { Role, Account as AuthUser, ManagedAccount as ManagedUser } from "../../shared/domain/auth";
export type { Role, Account as AuthUser, ManagedAccount as ManagedUser } from "../../shared/domain/auth";
export interface CredentialsUser extends AuthUser { passwordHash: string; passwordSalt: string }
export interface NewAccount { id: string; name: string; email: string; passwordHash: string; passwordSalt: string; createdAt: number }
export interface DocumentRecord { data: string; revision: number }

/** Product-specific ports keep application rules independent of the database driver. */
export interface Persistence {
  accounts: {
    create(account: NewAccount): Promise<AuthUser>;
    findByEmail(email: string): Promise<CredentialsUser | null>;
    list(): Promise<ManagedUser[]>;
    setRole(id: string, role: Role): Promise<boolean>;
  };
  sessions: {
    create(tokenHash: string, userId: string, expiresAt: number): Promise<void>;
    revoke(tokenHash: string): Promise<void>;
    findUser(tokenHash: string, now: number): Promise<AuthUser | null>;
  };
  libraries: {
    find(ownerId: string): Promise<DocumentRecord | null>;
    save(ownerId: string, data: string, expectedRevision: number): Promise<boolean>;
  };
  rooms: {
    find(code: string): Promise<DocumentRecord | null>;
    insert(code: string, data: string, createdAt: number): Promise<boolean>;
    save(code: string, data: string, expectedRevision: number): Promise<boolean>;
    purgeBefore(timestamp: number): Promise<void>;
  };
  health(): Promise<{ ready: boolean; database: boolean; rooms: boolean }>;
}
