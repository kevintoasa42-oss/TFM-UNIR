import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import WebSocket from "ws";

const base = process.env.FLASHRETO_URL;
const record = JSON.parse(await readFile(process.env.FLASHRETO_TEST_RECORD, "utf8"));
const response = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: record.email, password: record.password }) });
assert.equal(response.status, 200, "La cuenta sobrevive a recrear los contenedores");
const cookie = response.headers.get("set-cookie").split(";")[0];
const content = await (await fetch(`${base}/api/content`, { headers: { Cookie: cookie } })).json();
assert.equal(content.content.questions[0].id, record.questionId, "Las preguntas sobreviven en el volumen PostgreSQL");
const socket = new WebSocket(`${base.replace(/^http/, "ws")}/api/rooms/${record.roomCode}/ws`, { headers: { Cookie: cookie, Origin: base } });
try {
  const room = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No llegó la sala persistida")), 5000);
    socket.once("error", (error) => { clearTimeout(timer); reject(error); });
    socket.once("message", (data) => { clearTimeout(timer); resolve(JSON.parse(data.toString()).room); });
  });
  assert.equal(room.phase, "finished");
  assert.equal(room.players.find((player) => player.id === record.userId).score, 100, "La clasificación también sobrevive");
} finally { socket.close(); }
console.log("Persistencia correcta tras recrear los contenedores: cuenta, pregunta y clasificación.");
