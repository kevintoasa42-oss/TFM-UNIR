import test from "node:test";
import assert from "node:assert/strict";
import { saveQuestion, deleteQuestion, saveExam, DomainError } from "../src/domain/content.ts";
import { createGame, joinGame, startGame, answerGame, revealGame, nextGameQuestion } from "../src/domain/game.ts";
import { parseQuestionCsv } from "../src/features/import/csv.ts";
import { seedContent } from "../src/infrastructure/seed.ts";
import { browserContentRepository } from "../src/infrastructure/content-repository.ts";

const fresh = () => structuredClone(seedContent);
const draft = { topicId: "biologia", prompt: "¿Cuál es la unidad de la vida?", options: ["Célula", "Átomo", "Tejido", "Órgano"], correctIndex: 0 };

test("creación y asociaciones del contenido", () => {
  const state = saveQuestion(fresh(), draft);
  const created = state.questions.at(-1);
  assert.equal(created.topicId, "biologia");
  assert.equal(created.options[created.correctIndex], "Célula");
  const withExam = saveExam(state, "biologia", "Nuevo examen", [created.id]);
  assert.equal(withExam.exams.at(-1).questionIds[0], created.id);
  assert.throws(() => saveExam(state, "historia", "Cruce inválido", [created.id]), DomainError);
  assert.throws(() => deleteQuestion(withExam, created.id), /Retira esta pregunta/);
  assert.throws(() => saveQuestion(state, { ...draft, options: ["Igual", "igual", "C", "D"] }), /distintas/);
  assert.throws(() => saveQuestion({ ...state, currentUserId: "mateo" }, draft), /No tienes acceso/);
});

test("persistencia local: conserva contenido y recupera datos iniciales ante corrupción", () => {
  const entries = new Map();
  const old = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  try {
    const changed = saveQuestion(browserContentRepository.load(), draft);
    browserContentRepository.save(changed);
    assert.equal(browserContentRepository.load().questions.length, seedContent.questions.length + 1);
    entries.set("flashreto-content-v1", "{mal json");
    assert.equal(browserContentRepository.load().questions.length, seedContent.questions.length);
  } finally {
    if (old === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = old;
  }
});

test("CSV: comillas, respuesta y errores por fila", () => {
  const csv = 'pregunta,opcion_a,opcion_b,opcion_c,opcion_d,correcta\n"¿Cuál, de estas?",Sí,No,Tal vez,Ninguna,A\nOtra pregunta,A,B,C,D,X';
  const rows = parseQuestionCsv(csv, "biologia");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].draft.prompt, "¿Cuál, de estas?");
  assert.equal(rows[0].draft.correctIndex, 0);
  assert.match(rows[1].error, /A, B, C o D/);
  assert.throws(() => parseQuestionCsv("pregunta,correcta\nUna,A", "biologia"), /Faltan columnas/);
});

test("partida: tiempo, una respuesta por jugador y puntuación única", () => {
  const room = createGame("exam-bio", "Lucía");
  assert.match(room.code, /^\d{6}$/);
  assert.throws(() => joinGame(room, "000000", "Alex"), /código/);
  const joined = joinGame(room, room.code, "Alex");
  const started = startGame(joined, 1_000);
  const first = answerGame(started, "host", 0, 2_000);
  assert.equal(answerGame(first, "host", 1, 3_000), first);
  assert.equal(answerGame(first, "guest", 0, 21_000), first);
  const both = answerGame(first, "guest", 1, 5_000);
  const revealed = revealGame(both, fresh().questions[0]);
  assert.equal(revealed.players[0].score, 100);
  assert.equal(revealed.players[1].score, 0);
  assert.equal(revealGame(revealed, fresh().questions[0]), revealed);
  const next = nextGameQuestion(revealed, 2, 6_000);
  assert.equal(next.players[0].answer, null);
  assert.equal(next.questionIndex, 1);
});
