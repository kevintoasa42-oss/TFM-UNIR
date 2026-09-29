import test from "node:test";
import assert from "node:assert/strict";
import { saveArea, saveTopic, saveQuestion, deleteQuestion, saveExam, DomainError } from "../src/domain/content.ts";
import { newRoom, joinRoom, startRoom, answerRoom, expireRoom, revealRoom, advanceRoom, roomView } from "../src/domain/room.ts";
import { parseQuestionCsv } from "../src/features/import/csv.ts";

const ownerId = "ba261071-e0e0-4fe9-a177-a4501b2a8907";
const fresh = () => ({ users: [{ id: ownerId, name: "Admin", initials: "A", color: "#7258d6" }], currentUserId: ownerId, areas: [], topics: [], questions: [], exams: [] });

test("área → tema → pregunta → examen mantienen sus asociaciones", () => {
  const area = saveArea(fresh(), "Ciencias", "✦", "mint");
  const topic = saveTopic(area, area.areas[0].id, "Biología", "Células");
  const draft = { topicId: topic.topics[0].id, prompt: "¿Cuál es la unidad de la vida?", options: ["Célula", "Átomo", "Tejido", "Órgano"], correctIndex: 0 };
  const state = saveQuestion(topic, draft);
  const question = state.questions[0];
  assert.equal(question.options[question.correctIndex], "Célula");
  const withExam = saveExam(state, topic.topics[0].id, "Examen", [question.id]);
  assert.equal(withExam.exams[0].questionIds[0], question.id);
  assert.throws(() => deleteQuestion(withExam, question.id), /Retira esta pregunta/);
  assert.throws(() => saveQuestion(state, { ...draft, options: ["Igual", "igual", "C", "D"] }), /distintas/);
  assert.throws(() => saveQuestion({ ...state, currentUserId: "otra-cuenta" }, draft), /No tienes acceso/);
  assert.throws(() => saveExam(state, "tema-incorrecto", "Inválido", [question.id]), DomainError);
});

test("CSV informa errores por fila y acepta comillas", () => {
  const csv = 'pregunta,opcion_a,opcion_b,opcion_c,opcion_d,correcta\n"¿Cuál, de estas?",Sí,No,Tal vez,Ninguna,A\nOtra pregunta,A,B,C,D,X';
  const rows = parseQuestionCsv(csv, "tema");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].draft.prompt, "¿Cuál, de estas?");
  assert.equal(rows[0].draft.correctIndex, 0);
  assert.match(rows[1].error, /A, B, C o D/);
  assert.throws(() => parseQuestionCsv("pregunta,correcta\nUna,A", "tema"), /Faltan columnas/);
});

const question = { id: "q1", topicId: "t1", prompt: "¿Cuál es la unidad de la vida?", options: ["Célula", "Átomo", "Tejido", "Órgano"], correctIndex: 0 };

test("sala: dos jugadores, solución oculta, puntuación y final", () => {
  const lobby = newRoom("123456", "Examen", "host", "Ana", [question]);
  assert.throws(() => newRoom("111111", "Vacío", "host", "Ana", []), /no tiene preguntas/);
  const joined = joinRoom(lobby, "guest", "Luis");
  assert.throws(() => joinRoom(joined, "third", "Eva"), /completa/);
  assert.throws(() => startRoom(joined, "guest", 1000), /anfitrión/);
  const started = startRoom(joined, "host", 1000);
  assert.equal("correctIndex" in roomView(started, "guest").question, false);
  const hostAnswered = answerRoom(started, "host", 0, 2000);
  assert.throws(() => answerRoom(hostAnswered, "host", 1, 3000), /Ya respondiste/);
  const revealed = answerRoom(hostAnswered, "guest", 1, 4000);
  assert.equal(revealed.phase, "reveal");
  assert.equal(revealed.players[0].score, 100);
  assert.equal(revealed.players[1].score, 0);
  assert.equal(roomView(revealed, "guest").question.correctIndex, 0);
  assert.equal(revealRoom(revealed), revealed, "no se duplica la puntuación");
  assert.throws(() => advanceRoom(revealed, "guest", 5000), /anfitrión/);
  assert.equal(advanceRoom(revealed, "host", 5000).phase, "finished");
});

test("sala: rechaza respuesta tardía y cierra al terminar los 20 segundos", () => {
  const started = startRoom(joinRoom(newRoom("123456", "Examen", "host", "Ana", [question]), "guest", "Luis"), "host", 1000);
  assert.throws(() => answerRoom(started, "guest", 0, 21_000), /tiempo/);
  const expired = expireRoom(started, 21_000);
  assert.equal(expired.phase, "reveal");
  assert.equal(expired.players[0].score, 0);
  assert.equal(expireRoom(expired, 50_000), expired);
});
