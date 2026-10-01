import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { WebSocketServer } from "ws";
import { api } from "./router";
import { postgresPersistence } from "./adapters/postgres";
import { migratePostgres } from "./adapters/postgres-migrations";
import { requireUser } from "./auth";
import { errorResponse, HttpError, sameOrigin } from "./http";
import { attachRoomSocket, loadRoomConnection } from "./room-socket";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Configura DATABASE_URL para iniciar el backend PostgreSQL.");
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT no es válido.");
const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 10_000 });
pool.on("error", (error) => console.error("La conexión PostgreSQL falló:", error.message));
await migratePostgres(pool, fileURLToPath(new URL("../../db/postgres/", import.meta.url)));
const store = postgresPersistence(pool);
const publicRoot = resolve(fileURLToPath(new URL("../../frontend/dist/", import.meta.url)));
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
};

function webRequest(request: IncomingMessage, body?: Buffer): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((part) => headers.append(name, part));
    else if (value !== undefined) headers.set(name, value);
  }
  return new Request(new URL(request.url ?? "/", `http://${request.headers.host ?? `localhost:${port}`}`), {
    method: request.method ?? "GET", headers, body: body ? new Uint8Array(body) : undefined,
  });
}

async function readBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > 2_500_000) throw new HttpError(413, "La solicitud supera el tamaño permitido.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

async function respond(response: ServerResponse, result: Response, head = false): Promise<void> {
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(head ? undefined : Buffer.from(await result.arrayBuffer()));
}

async function staticResponse(pathname: string): Promise<Response> {
  let file: string;
  try { file = resolve(publicRoot, `.${decodeURIComponent(pathname)}`); }
  catch { throw new HttpError(400, "Ruta no válida."); }
  if (file !== publicRoot && !file.startsWith(`${publicRoot}${sep}`)) throw new HttpError(403, "Ruta no permitida.");
  if (!(await stat(file).catch(() => null))?.isFile()) {
    if (extname(pathname)) throw new HttpError(404, "Archivo no encontrado.");
    file = resolve(publicRoot, "index.html");
  }
  const bytes = await readFile(file);
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": mime[extname(file)] ?? "application/octet-stream",
    "Cache-Control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  } });
}

const server = createServer((request, response) => {
  void (async () => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) return await respond(response, await api(webRequest(request, await readBody(request)), store), request.method === "HEAD");
      if (!["GET", "HEAD"].includes(request.method ?? "")) throw new HttpError(405, "Método no permitido.");
      await respond(response, await staticResponse(url.pathname), request.method === "HEAD");
    } catch (error) { if (!response.headersSent) await respond(response, errorResponse(error)); else response.destroy(); }
  })();
});

const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on("upgrade", (request, socket, head) => {
  socket.on("error", () => socket.destroy());
  void (async () => {
    try {
      const incoming = webRequest(request);
      const match = /^\/api\/rooms\/(\d{6})\/ws$/.exec(new URL(incoming.url).pathname);
      if (!match) throw new HttpError(404, "Ruta no encontrada.");
      sameOrigin(incoming);
      const user = await requireUser(store.sessions, incoming);
      const initial = await loadRoomConnection(store.rooms, match[1], user.id);
      sockets.handleUpgrade(request, socket, head, (client) => {
        attachRoomSocket({
          get readyState() { return client.readyState; },
          send: (data) => client.send(data),
          close: (code, reason) => client.close(code, reason),
          onMessage: (listener) => client.on("message", (data, binary) => listener(binary ? data : data.toString())),
          onClose: (listener) => client.on("close", listener),
          onError: (listener) => client.on("error", listener),
        }, store.rooms, match[1], user.id, initial);
      });
    } catch (error) {
      const result = errorResponse(error);
      const text = await result.text();
      socket.end(`HTTP/1.1 ${result.status} Error\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(text)}\r\nConnection: close\r\n\r\n${text}`);
    }
  })();
});

server.listen(port, process.env.HOST ?? "0.0.0.0", () => console.log(`FlashReto con PostgreSQL: http://localhost:${port}`));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const client of sockets.clients) client.close(1001, "Servidor detenido");
  setTimeout(() => process.exit(1), 5000).unref();
  await new Promise<void>((done) => server.close(() => done()));
  await pool.end();
}
process.on("SIGTERM", () => { void stop(); });
process.on("SIGINT", () => { void stop(); });
