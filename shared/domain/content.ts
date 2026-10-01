import { z } from "zod";
import type { AnswerIndex, Area, ContentState, DraftQuestion, Exam, Question, Topic } from "./models";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

const answerIndex = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const questionDraftSchema = z.object({
  topicId: z.string().min(1, "Selecciona un tema."),
  prompt: z.string().trim().min(5, "La pregunta debe tener al menos 5 caracteres."),
  options: z.tuple([
    z.string().trim().min(1, "Completa las cuatro opciones."),
    z.string().trim().min(1, "Completa las cuatro opciones."),
    z.string().trim().min(1, "Completa las cuatro opciones."),
    z.string().trim().min(1, "Completa las cuatro opciones."),
  ]),
  correctIndex: answerIndex,
}).superRefine((draft, ctx) => {
  if (new Set(draft.options.map((option) => option.toLocaleLowerCase())).size !== 4) {
    ctx.addIssue({ code: "custom", message: "Las cuatro opciones deben ser distintas.", path: ["options"] });
  }
});

export function getOwnedArea(state: ContentState, areaId: string): Area {
  const area = state.areas.find((item) => item.id === areaId && item.ownerId === state.currentUserId);
  if (!area) throw new DomainError("No tienes acceso a esta área.");
  return area;
}

export function getOwnedTopic(state: ContentState, topicId: string): Topic {
  const topic = state.topics.find((item) => item.id === topicId);
  if (!topic) throw new DomainError("Selecciona un tema válido.");
  getOwnedArea(state, topic.areaId);
  return topic;
}

export function saveArea(state: ContentState, name: string, icon: string, color: string, id?: string): ContentState {
  const clean = name.trim();
  if (!clean) throw new DomainError("Escribe el nombre del área.");
  if (state.areas.some((area) => area.ownerId === state.currentUserId && area.name.toLowerCase() === clean.toLowerCase() && area.id !== id)) {
    throw new DomainError("Ya tienes un área con ese nombre.");
  }
  const area = { id: id ?? crypto.randomUUID(), ownerId: state.currentUserId, name: clean, icon, color };
  if (id) getOwnedArea(state, id);
  return { ...state, areas: id ? state.areas.map((item) => item.id === id ? area : item) : [...state.areas, area] };
}

export function deleteArea(state: ContentState, id: string): ContentState {
  getOwnedArea(state, id);
  if (state.topics.some((topic) => topic.areaId === id)) throw new DomainError("Elimina primero los temas de esta área.");
  return { ...state, areas: state.areas.filter((area) => area.id !== id) };
}

export function saveTopic(state: ContentState, areaId: string, name: string, description: string, id?: string): ContentState {
  getOwnedArea(state, areaId);
  const clean = name.trim();
  if (!clean) throw new DomainError("Escribe el nombre del tema.");
  if (state.topics.some((topic) => topic.areaId === areaId && topic.name.toLowerCase() === clean.toLowerCase() && topic.id !== id)) {
    throw new DomainError("Ya existe un tema con ese nombre en el área.");
  }
  if (id) getOwnedTopic(state, id);
  const topic = { id: id ?? crypto.randomUUID(), areaId, name: clean, description: description.trim() };
  return { ...state, topics: id ? state.topics.map((item) => item.id === id ? topic : item) : [...state.topics, topic] };
}

export function deleteTopic(state: ContentState, id: string): ContentState {
  getOwnedTopic(state, id);
  if (state.questions.some((question) => question.topicId === id) || state.exams.some((exam) => exam.topicId === id)) {
    throw new DomainError("Elimina primero las preguntas y exámenes de este tema.");
  }
  return { ...state, topics: state.topics.filter((topic) => topic.id !== id) };
}

export function saveQuestion(state: ContentState, draft: DraftQuestion, id?: string): ContentState {
  const parsed = questionDraftSchema.safeParse(draft);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa la pregunta.");
  getOwnedTopic(state, draft.topicId);
  if (id) {
    const old = state.questions.find((question) => question.id === id);
    if (!old) throw new DomainError("La pregunta no existe.");
    getOwnedTopic(state, old.topicId);
    if (old.topicId !== draft.topicId && state.exams.some((exam) => exam.questionIds.includes(id))) {
      throw new DomainError("Retira la pregunta de sus exámenes antes de cambiarla de tema.");
    }
  }
  const question: Question = { ...parsed.data, id: id ?? crypto.randomUUID(), correctIndex: parsed.data.correctIndex as AnswerIndex };
  return { ...state, questions: id ? state.questions.map((item) => item.id === id ? question : item) : [...state.questions, question] };
}

export function deleteQuestion(state: ContentState, id: string): ContentState {
  const question = state.questions.find((item) => item.id === id);
  if (!question) throw new DomainError("La pregunta no existe.");
  getOwnedTopic(state, question.topicId);
  if (state.exams.some((exam) => exam.questionIds.includes(id))) {
    throw new DomainError("Retira esta pregunta de sus exámenes antes de eliminarla.");
  }
  return { ...state, questions: state.questions.filter((item) => item.id !== id) };
}

export function saveExam(state: ContentState, topicId: string, name: string, questionIds: string[], id?: string): ContentState {
  getOwnedTopic(state, topicId);
  const clean = name.trim();
  if (!clean) throw new DomainError("Escribe el nombre del examen.");
  if (questionIds.length === 0) throw new DomainError("Selecciona al menos una pregunta.");
  if (new Set(questionIds).size !== questionIds.length || questionIds.some((questionId) => !state.questions.some((question) => question.id === questionId && question.topicId === topicId))) {
    throw new DomainError("El examen solo puede contener preguntas distintas de su tema.");
  }
  if (id) {
    const old = state.exams.find((exam) => exam.id === id);
    if (!old) throw new DomainError("El examen no existe.");
    getOwnedTopic(state, old.topicId);
  }
  const exam: Exam = { id: id ?? crypto.randomUUID(), topicId, name: clean, questionIds };
  return { ...state, exams: id ? state.exams.map((item) => item.id === id ? exam : item) : [...state.exams, exam] };
}

export function deleteExam(state: ContentState, id: string): ContentState {
  const exam = state.exams.find((item) => item.id === id);
  if (!exam) throw new DomainError("El examen no existe.");
  getOwnedTopic(state, exam.topicId);
  return { ...state, exams: state.exams.filter((item) => item.id !== id) };
}
