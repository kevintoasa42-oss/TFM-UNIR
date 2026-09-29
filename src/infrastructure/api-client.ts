import type { ContentState } from "../domain/models";
import type { Role } from "../server/auth";

export interface Account { id: string; name: string; email: string; role: Role }
export interface ManagedAccount extends Account { createdAt: number }

async function request<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(path, { method, credentials: "same-origin", headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "No se pudo completar la solicitud.");
  return result;
}

export const apiClient = {
  me: () => request<{ user: Account | null }>("/api/me"),
  register: (name: string, email: string, password: string) => request<{ user: Account }>("/api/register", "POST", { name, email, password }),
  login: (email: string, password: string) => request<{ user: Account }>("/api/login", "POST", { email, password }),
  logout: () => request<{ ok: true }>("/api/logout", "POST"),
  content: () => request<{ content: ContentState; revision: number }>("/api/content"),
  saveContent: (content: ContentState, revision: number) => request<{ content: ContentState; revision: number }>("/api/content", "PUT", { content, revision }),
  users: () => request<{ users: ManagedAccount[] }>("/api/users"),
  setRole: (id: string, role: Role) => request<{ ok: true }>(`/api/users/${encodeURIComponent(id)}`, "PATCH", { role }),
  createRoom: (examId: string) => request<{ code: string }>("/api/rooms", "POST", { examId }),
  joinRoom: (code: string) => request<{ room: unknown }>(`/api/rooms/${code}/join`, "POST"),
};
