import test from "node:test";
import assert from "node:assert/strict";
import { saveArea, saveTopic, saveQuestion, deleteQuestion, saveExam, DomainError } from "../src/domain/content.ts";
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

