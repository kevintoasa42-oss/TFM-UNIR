import { z } from "zod";
import { body, json, parse } from "../http.ts";
import type { AuthenticatedContext } from "../routes/types.ts";
import { readContent, writeLibrary } from "../services/content.service.ts";

const saveSchema = z.object({ content: z.unknown(), revision: z.number().int().min(0) });

export async function read({ store, user }: AuthenticatedContext): Promise<Response> {
  return json(await readContent(store.libraries, user));
}

export async function save({ request, store, user }: AuthenticatedContext): Promise<Response> {
  const input = parse(saveSchema, await body(request));
  return json(await writeLibrary(store.libraries, user, input.content, input.revision));
}
