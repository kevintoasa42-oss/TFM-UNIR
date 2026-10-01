import test from "node:test";
import assert from "node:assert/strict";
import { createHash, pbkdf2Sync } from "node:crypto";
import { api } from "../src/router.ts";
import { loginAccount } from "../src/services/auth.service.ts";

const userId = "ba261071-e0e0-4fe9-a177-a4501b2a8907";
const user = { id: userId, name: "Usuario de prueba", email: "user@example.test", role: "user" };
const admin = { ...user, role: "admin" };
const token = "a".repeat(64);
const cookie = `fr_session=${token}`;

function storeFor(account = null) {
  return {
    health: async () => ({ ready: true, database: true, rooms: true }),
    sessions: { findUser: async () => account },
    libraries: { find: async () => null },
  };
}

function request(path, method = "GET", headers = {}, body) {
  return new Request(`http://localhost${path}`, { method, headers, body });
}

const protectedRequests = [
  ["GET", "/api/content"], ["PUT", "/api/content"], ["GET", "/api/users"],
  ["PATCH", `/api/users/${userId}`], ["POST", "/api/rooms"],
  ["POST", "/api/rooms/123456/join"], ["GET", "/api/rooms/123456/ws"],
];

test("API: salud y sesión pública mantienen su contrato", async () => {
  const health = await api(request("/api/health"), storeFor());
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ready: true, database: true, rooms: true });
  assert.equal(health.headers.get("cache-control"), "no-store");
  const unavailable = await api(request("/api/health"), { health: async () => ({ ready: false, database: true, rooms: false }) });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await (await api(request("/api/me"), storeFor())).json(), { user: null });
});

test("API: todas las operaciones protegidas rechazan una sesión ausente o vencida", async () => {
  for (const [method, path] of protectedRequests) {
    for (const headers of [{}, { Cookie: cookie }]) {
      const response = await api(request(path, method, headers), storeFor());
      assert.equal(response.status, 401, `${method} ${path}`);
      assert.deepEqual(await response.json(), { error: "Inicia sesión para continuar." });
    }
  }
});

test("API: usuario sigue sin poder administrar contenido, roles o crear salas", async () => {
  for (const [method, path] of protectedRequests.filter(([method, path]) => method === "PUT" || method === "PATCH" || path === "/api/users" || path === "/api/rooms")) {
    const response = await api(request(path, method, { Cookie: cookie }), storeFor(user));
    assert.equal(response.status, 403, `${method} ${path}`);
  }
  const store = storeFor(user);
  store.libraries.find = async () => assert.fail("Un usuario no consulta la biblioteca del administrador");
  const response = await api(request("/api/content", "GET", { Cookie: cookie }), store);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.revision, 0);
  assert.equal(result.content.currentUserId, userId);
  assert.deepEqual(result.content.questions, []);
});

test("API: origen, JSON, parámetros y rutas desconocidas conservan sus errores", async () => {
  const forbidden = await api(request("/api/login", "POST", { Origin: "https://otro.example" }), storeFor());
  assert.equal(forbidden.status, 403);
  const media = await api(request("/api/login", "POST", {}, "texto"), storeFor());
  assert.equal(media.status, 415);
  const malformed = await api(request("/api/login", "POST", { "Content-Type": "application/json" }, "{"), storeFor());
  assert.equal(malformed.status, 400);
  const invalidId = await api(request("/api/users/no-es-uuid", "PATCH", { Cookie: cookie }), storeFor(admin));
  assert.equal(invalidId.status, 400);
  assert.equal((await api(request("/api/desconocida"), storeFor())).status, 401);
  assert.equal((await api(request("/api/desconocida", "GET", { Cookie: cookie }), storeFor(user))).status, 404);
  assert.equal((await api(request("/api/rooms/abc/join", "POST", { Cookie: cookie }), storeFor(user))).status, 404);
});

test("API: WebSocket exige sesión, origen y upgrade, y pasa el mismo código y usuario al transporte", async () => {
  const path = "/api/rooms/123456/ws";
  assert.equal((await api(request(path, "GET", { Cookie: cookie }), storeFor(user))).status, 426);
  assert.equal((await api(request(path, "GET", { Cookie: cookie, Upgrade: "websocket", Origin: "https://otro.example" }), storeFor(user))).status, 403);
  const response = await api(request(path, "GET", { Cookie: cookie, Upgrade: "websocket", Origin: "http://localhost" }), storeFor(user), async (code, id) => {
    assert.equal(code, "123456");
    assert.equal(id, userId);
    return new Response("Transporte de prueba");
  });
  assert.equal(await response.text(), "Transporte de prueba");
});

test("API: las cookies existentes se consultan y revocan con el mismo hash", async () => {
  const hash = createHash("sha256").update(token).digest("hex");
  const store = storeFor(user);
  store.sessions.findUser = async (received) => { assert.equal(received, hash); return user; };
  store.sessions.revoke = async (received) => { assert.equal(received, hash); };
  const me = await api(request("/api/me", "GET", { Cookie: cookie }), store);
  assert.deepEqual(await me.json(), { user });
  const logout = await api(new Request("https://localhost/api/logout", { method: "POST", headers: { Cookie: cookie } }), store);
  assert.equal(logout.status, 200);
  assert.equal(logout.headers.get("set-cookie"), "fr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
});

test("servicio: cuentas con el formato PBKDF2 anterior siguen iniciando sesión sin exponer credenciales", async () => {
  const password = "Compatibilidad-123!";
  const salt = "00112233445566778899aabbccddeeff";
  const passwordHash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 310_000, 32, "sha256").toString("hex");
  const accounts = { findByEmail: async () => ({ ...user, passwordSalt: salt, passwordHash }) };
  assert.deepEqual(await loginAccount(accounts, { email: user.email, password }), user);
  await assert.rejects(loginAccount(accounts, { email: user.email, password: "Incorrecta-123!" }), /Correo o contraseña incorrectos/);
});
