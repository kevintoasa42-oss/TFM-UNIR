export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415, "Envía datos JSON.");
  try { return await request.json(); }
  catch { throw new HttpError(400, "El cuerpo JSON no es válido."); }
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Origen no permitido.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Origen no permitido.");
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: "Ocurrió un error en el servidor." }, 500);
}

export function database(env: Cloudflare.Env): D1Database {
  if (!env.DB) throw new HttpError(503, "La base de datos no está disponible.");
  return env.DB;
}
