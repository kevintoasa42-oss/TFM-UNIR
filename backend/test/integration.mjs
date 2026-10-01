import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import WebSocket from "ws";

const base = process.env.FLASHRETO_URL ?? "http://127.0.0.1:8787";
const tag = randomUUID().slice(0, 8);
const password = `Test-${randomUUID()}!`;

async function call(path, method = "GET", data, cookie) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
    const raw = await response.text();
    if (response.status === 503 && raw.includes("Your worker restarted mid-request") && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }
    let result;
    try { result = JSON.parse(raw); } catch { result = { error: raw }; }
    return { status: response.status, result, cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
}

class Client {
  constructor(code, cookie) {
    this.messages = [];
    this.socket = new WebSocket(`${base.replace(/^http/, "ws")}/api/rooms/${code}/ws`, { headers: { Cookie: cookie, Origin: base } });
    this.socket.on("message", (data) => { this.messages.push(JSON.parse(data.toString())); });
  }
  async open() { await new Promise((resolve, reject) => { this.socket.once("open", resolve); this.socket.once("error", reject); }); }
  async state(predicate, timeout = 5000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const found = this.messages.find((message) => message.type === "state" && predicate(message.room));
      if (found) return found.room;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`No llegó el estado esperado. Mensajes: ${JSON.stringify(this.messages)}`);
  }
  async error(predicate, timeout = 5000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const found = this.messages.find((message) => message.type === "error" && predicate(message.message));
      if (found) return found.message;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`No llegó el error esperado. Mensajes: ${JSON.stringify(this.messages)}`);
  }
  send(action) { this.socket.send(JSON.stringify(action)); }
  close() { this.socket.close(); }
}

// Folder changes must preserve the browser entry and the assets served by both runtimes.
const page = await fetch(base);
assert.equal(page.status, 200, "El frontend está disponible");
const html = await page.text();
const assets = [...new Set([...html.matchAll(/(?:src|href)="([^"?]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map((match) => match[1]).filter((path) => path.startsWith("/")))];
assert.ok(assets.some((path) => path.split("?")[0].endsWith(".js")), "La página incluye el JavaScript del frontend");
assert.ok(assets.some((path) => path.split("?")[0].endsWith(".css")), "La página incluye los estilos del frontend");
for (const path of assets) {
  const asset = await fetch(new URL(path, base));
  assert.equal(asset.status, 200, `El archivo ${path} está disponible`);
  assert.match(asset.headers.get("content-type") ?? "", /javascript|text\/css/);
}

assert.deepEqual((await call("/api/health")).result, { ready: true, database: true, rooms: true });
const user = await call("/api/register", "POST", { name: "Luis Prueba", email: `luis-${tag}@example.test`, password, role: "user" });
assert.equal(user.status, 201, JSON.stringify(user.result));
assert.equal(user.result.user.role, "user", "La primera cuenta conserva Usuario si así lo elige");
const admin = await call("/api/register", "POST", { name: "Ana Prueba", email: `ana-${tag}@example.test`, password, role: "admin" });
assert.equal(admin.status, 201, JSON.stringify(admin.result));
assert.equal(admin.result.user.role, "admin", "Se puede elegir Administrador aunque ya existan cuentas");
assert.equal((await call("/api/register", "POST", { name: "Duplicada", email: admin.result.user.email, password, role: "admin" })).status, 409);
for (const role of [undefined, "owner"]) {
  assert.equal((await call("/api/register", "POST", { name: "Rol inválido", email: `invalid-${tag}@example.test`, password, role })).status, 400);
}
assert.equal((await call("/api/login", "POST", { email: admin.result.user.email, password: "Incorrecta-123" })).status, 401);

const areaId = randomUUID(), topicId = randomUUID(), questionId = randomUUID(), examId = randomUUID();
const content = {
  users: [], currentUserId: admin.result.user.id,
  areas: [{ id: areaId, ownerId: admin.result.user.id, name: "Ciencias", icon: "✦", color: "mint" }],
  topics: [{ id: topicId, areaId, name: "Biología", description: "Células" }],
  questions: [{ id: questionId, topicId, prompt: "¿Cuál es la unidad de la vida?", options: ["Célula", "Átomo", "Tejido", "Órgano"], correctIndex: 0 }],
  exams: [{ id: examId, topicId, name: "Examen de biología", questionIds: [questionId] }],
};
const saved = await call("/api/content", "PUT", { content, revision: 0 }, admin.cookie);
assert.equal(saved.status, 200, JSON.stringify(saved.result));
assert.equal(saved.result.revision, 1);
const invalid = structuredClone(content);
invalid.areas[0].ownerId = user.result.user.id;
const invalidResult = await call("/api/content", "PUT", { content: invalid, revision: 1 }, admin.cookie);
assert.equal(invalidResult.status, 403, JSON.stringify(invalidResult.result));
assert.equal((await call("/api/content", "PUT", { content, revision: 0 }, admin.cookie)).status, 409);
assert.equal((await call("/api/content", "GET", undefined, admin.cookie)).result.content.questions[0].options[0], "Célula");
assert.equal((await call("/api/content", "PUT", { content: {}, revision: 0 }, user.cookie)).status, 403);
assert.equal((await call("/api/rooms", "POST", { examId: randomUUID() }, admin.cookie)).status, 404);

const created = await call("/api/rooms", "POST", { examId }, admin.cookie);
assert.equal(created.status, 201, JSON.stringify(created.result));
const code = created.result.code;
assert.match(code, /^\d{6}$/);
assert.equal((await call("/api/rooms/000000/join", "POST", {}, user.cookie)).status, 404);
assert.equal((await call(`/api/rooms/${code}/join`, "POST", {}, user.cookie)).status, 200);

const host = new Client(code, admin.cookie), guest = new Client(code, user.cookie);
try {
  await Promise.all([host.open(), guest.open()]);
  assert.equal((await host.state((room) => room.phase === "lobby" && room.players.length === 2)).players.length, 2);
  host.send({ type: "start" });
  const [hostQuestion, guestQuestion] = await Promise.all([
    host.state((room) => room.phase === "question"), guest.state((room) => room.phase === "question"),
  ]);
  assert.equal(hostQuestion.question.prompt, guestQuestion.question.prompt);
  assert.equal("correctIndex" in guestQuestion.question, false, "La solución queda oculta durante la pregunta");
  guest.send({ type: "answer", answer: 1 });
  host.send({ type: "answer", answer: 0 });
  const [hostReveal, guestReveal] = await Promise.all([
    host.state((room) => room.phase === "reveal"), guest.state((room) => room.phase === "reveal"),
  ]);
  assert.equal(hostReveal.question.correctIndex, 0);
  assert.equal(guestReveal.question.correctIndex, 0);
  assert.equal(hostReveal.players.find((player) => player.id === admin.result.user.id).score, 100);
  assert.equal(guestReveal.players.find((player) => player.id === user.result.user.id).score, 0);
  host.send({ type: "next" });
  assert.equal((await guest.state((room) => room.phase === "finished")).phase, "finished");
} finally { host.close(); guest.close(); }

const second = await call("/api/rooms", "POST", { examId }, admin.cookie);
assert.equal(second.status, 201, JSON.stringify(second.result));
assert.equal((await call(`/api/rooms/${second.result.code}/join`, "POST", {}, user.cookie)).status, 200);
const host2 = new Client(second.result.code, admin.cookie), guest2 = new Client(second.result.code, user.cookie);
try {
  await Promise.all([host2.open(), guest2.open()]);
  await host2.state((room) => room.phase === "lobby" && room.players.length === 2);
  host2.send({ type: "start" });
  await guest2.state((room) => room.phase === "question");
  const timeoutReveal = await guest2.state((room) => room.phase === "reveal", 25_000);
  assert.equal(timeoutReveal.players.every((player) => player.score === 0), true);
  guest2.send({ type: "answer", answer: 0 });
  assert.match(await guest2.error((message) => /tiempo/.test(message)), /tiempo/);
} finally { host2.close(); guest2.close(); }

assert.equal((await call("/api/users", "GET", undefined, user.cookie)).status, 403);
const listed = await call("/api/users", "GET", undefined, admin.cookie);
assert.equal(listed.status, 200);
assert.equal(listed.result.users.length >= 2, true);
assert.equal((await call(`/api/users/${user.result.user.id}`, "PATCH", { role: "admin" }, admin.cookie)).status, 200);
assert.equal((await call("/api/me", "GET", undefined, user.cookie)).result.user.role, "admin");
assert.equal((await call(`/api/users/${admin.result.user.id}`, "PATCH", { role: "user" }, user.cookie)).status, 200);
const anotherAdmin = await call("/api/register", "POST", { name: "Nueva Cuenta", email: `nueva-${tag}@example.test`, password, role: "admin" });
assert.equal(anotherAdmin.status, 201);
assert.equal(anotherAdmin.result.user.role, "admin", "Cada cuenta puede elegir Administrador al registrarse");
assert.equal((await call("/api/me", "GET", undefined, admin.cookie)).result.user.role, "user", "Un registro posterior no recupera un rol retirado");
assert.equal((await call(`/api/users/${admin.result.user.id}`, "PATCH", { role: "admin" }, user.cookie)).status, 200);
assert.equal((await call(`/api/users/${user.result.user.id}`, "PATCH", { role: "user" }, admin.cookie)).status, 200);
assert.equal((await call("/api/me", "GET", undefined, user.cookie)).result.user.role, "user");

await call("/api/logout", "POST", undefined, admin.cookie);
const loggedIn = await call("/api/login", "POST", { email: admin.result.user.email, password });
assert.equal(loggedIn.status, 200);
assert.equal(loggedIn.result.user.role, "admin");
assert.equal((await call("/api/content", "GET", undefined, loggedIn.cookie)).result.content.questions.length, 1);
if (process.env.FLASHRETO_TEST_RECORD) await writeFile(process.env.FLASHRETO_TEST_RECORD, JSON.stringify({ email: admin.result.user.email, password, questionId, roomCode: code, userId: admin.result.user.id }), { mode: 0o600 });
console.log("Integración correcta: autenticación, roles, persistencia, dos clientes WebSocket y cierre por temporizador.");
