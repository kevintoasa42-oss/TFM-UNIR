import { z } from "zod";
import type { ContentState } from "../domain/models";
import { questionDraftSchema } from "../domain/content";
import type { AuthUser } from "./auth";
import { HttpError } from "./http";

const id = z.string().uuid();
const area = z.object({ id, ownerId: id, name: z.string().trim().min(1).max(100), icon: z.string().max(8), color: z.string().max(24) });
const topic = z.object({ id, areaId: id, name: z.string().trim().min(1).max(100), description: z.string().max(500) });
const question = questionDraftSchema.and(z.object({ id }));
const exam = z.object({ id, topicId: id, name: z.string().trim().min(1).max(100), questionIds: z.array(id).min(1).max(100) });
const librarySchema = z.object({
  areas: z.array(area).max(200), topics: z.array(topic).max(1000),
  questions: z.array(question).max(10_000), exams: z.array(exam).max(1000),
});

function publicUser(user: AuthUser) {
  return { id: user.id, name: user.name, initials: user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""), color: "#7258d6" };
}

export function emptyContent(user: AuthUser): ContentState {
  return { users: [publicUser(user)], currentUserId: user.id, areas: [], topics: [], questions: [], exams: [] };
}

export function validateLibrary(value: unknown, user: AuthUser): ContentState {
  const parsed = librarySchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "La biblioteca no es válida.");
  const { areas, topics, questions, exams } = parsed.data;
  for (const [label, entries] of [["área", areas], ["tema", topics], ["pregunta", questions], ["examen", exams]] as const) {
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new HttpError(400, `Hay identificadores de ${label} repetidos.`);
  }
  if (areas.some((entry) => entry.ownerId !== user.id)) throw new HttpError(403, "No puedes guardar áreas de otra cuenta.");
  const areaIds = new Set(areas.map((entry) => entry.id));
  if (topics.some((entry) => !areaIds.has(entry.areaId))) throw new HttpError(400, "Hay temas sin un área válida.");
  const topicIds = new Set(topics.map((entry) => entry.id));
  if (questions.some((entry) => !topicIds.has(entry.topicId))) throw new HttpError(400, "Hay preguntas sin un tema válido.");
  const questionsById = new Map(questions.map((entry) => [entry.id, entry]));
  if (exams.some((entry) => !topicIds.has(entry.topicId) || new Set(entry.questionIds).size !== entry.questionIds.length || entry.questionIds.some((questionId) => questionsById.get(questionId)?.topicId !== entry.topicId))) {
    throw new HttpError(400, "Cada examen debe contener preguntas distintas de un solo tema.");
  }
  return { users: [publicUser(user)], currentUserId: user.id, areas, topics, questions, exams };
}

export async function readLibrary(db: D1Database, user: AuthUser): Promise<{ content: ContentState; revision: number }> {
  const row = await db.prepare("SELECT data, revision FROM libraries WHERE owner_id = ?").bind(user.id).first<{ data: string; revision: number }>();
  return row ? { content: validateLibrary(JSON.parse(row.data) as unknown, user), revision: row.revision } : { content: emptyContent(user), revision: 0 };
}

export async function writeLibrary(db: D1Database, user: AuthUser, value: unknown, revision: number): Promise<{ content: ContentState; revision: number }> {
  const content = validateLibrary(value, user);
  if (!Number.isSafeInteger(revision) || revision < 0) throw new HttpError(400, "La revisión no es válida.");
  const data = JSON.stringify(content);
  if (data.length > 2_000_000) throw new HttpError(413, "La biblioteca supera el tamaño permitido.");
  let result: D1Result;
  if (revision === 0) {
    result = await db.prepare("INSERT OR IGNORE INTO libraries (owner_id, data, revision) VALUES (?, ?, 1)").bind(user.id, data).run();
  } else {
    result = await db.prepare("UPDATE libraries SET data = ?, revision = revision + 1 WHERE owner_id = ? AND revision = ?")
      .bind(data, user.id, revision).run();
  }
  if (!result.meta.changes) throw new HttpError(409, "La biblioteca cambió en otra pestaña. Recárgala antes de guardar.");
  return { content, revision: revision + 1 };
}
