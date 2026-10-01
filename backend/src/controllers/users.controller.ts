import { z } from "zod";
import { body, json, parse } from "../http.ts";
import type { AuthenticatedContext } from "../routes/types.ts";
import { changeUserRole, listUsers } from "../services/users.service.ts";

const idSchema = z.string().uuid("La cuenta no es válida.");
const roleSchema = z.object({ role: z.enum(["admin", "user"]) });

export async function list({ store }: AuthenticatedContext): Promise<Response> {
  return json({ users: await listUsers(store.accounts) });
}

export async function setRole({ request, store, user, params }: AuthenticatedContext): Promise<Response> {
  const targetId = parse(idSchema, params.id);
  const { role } = parse(roleSchema, await body(request));
  await changeUserRole(store.accounts, user, targetId, role);
  return json({ ok: true });
}
