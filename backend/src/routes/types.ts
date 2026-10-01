import type { AuthUser, Persistence } from "../persistence.ts";
import type { PasswordIterations } from "../security/password.ts";

export interface PublicContext {
  request: Request;
  store: Persistence;
  params: Record<string, string>;
  connectRoom?: (code: string, userId: string) => Promise<Response>;
  passwordIterations?: PasswordIterations;
}

export interface AuthenticatedContext extends PublicContext { user: AuthUser }

interface RouteBase {
  method: "GET" | "POST" | "PUT" | "PATCH";
  path: string;
  constraints?: Record<string, RegExp>;
  transport?: "websocket";
}

export type ApiRoute = RouteBase & (
  | { access: "public"; handler: (context: PublicContext) => Promise<Response> }
  | { access: "authenticated" | "admin"; handler: (context: AuthenticatedContext) => Promise<Response> }
);
