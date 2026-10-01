import type { z } from "zod";
import { ApplicationError } from "./errors.ts";
export { ApplicationError as HttpError } from "./errors.ts";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApplicationError(415, "Envía datos JSON.");
  try { return await request.json(); }
  catch { throw new ApplicationError(400, "El cuerpo JSON no es válido."); }
}

export function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApplicationError(400, result.error.issues[0]?.message ?? "Revisa los datos.");
  return result.data;
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApplicationError(403, "Origen no permitido.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApplicationError(403, "Origen no permitido.");
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApplicationError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: "Ocurrió un error en el servidor." }, 500);
}
