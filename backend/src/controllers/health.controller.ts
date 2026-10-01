import { json } from "../http.ts";
import type { PublicContext } from "../routes/types.ts";

export async function read({ store }: PublicContext): Promise<Response> {
  const health = await store.health();
  return json(health, health.ready ? 200 : 503);
}
