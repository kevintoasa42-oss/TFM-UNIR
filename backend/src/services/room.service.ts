import { advanceRoom, answerRoom, expireRoom, joinRoom, newRoom, roomView, startRoom, type Room, type RoomView } from "../../../shared/domain/room.ts";
import type { Question } from "../../../shared/domain/models.ts";
import { ApplicationError } from "../errors.ts";
import type { AuthUser, Persistence } from "../persistence.ts";
import { readLibrary } from "./content.service.ts";

export type RoomAction = { type: "start" | "next" | "sync" } | { type: "answer"; answer: number };
export interface StoredRoom { room: Room; revision: number; error?: string }

function decode(row: { data: string; revision: number }): StoredRoom {
  return { room: JSON.parse(row.data) as Room, revision: row.revision };
}

/** A compare-and-swap update keeps one authoritative score even when two Workers answer at once. */
async function update(rooms: Persistence["rooms"], code: string, transform: (room: Room, now: number) => Room): Promise<StoredRoom> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await rooms.find(code);
    if (!row) throw new ApplicationError(404, "No existe una sala con ese código.");
    const old = decode(row);
    const now = Date.now();
    const expired = expireRoom(old.room, now);
    let next = expired;
    let error: string | undefined;
    try { next = transform(expired, now); }
    catch (cause) { error = cause instanceof Error ? cause.message : "No se pudo actualizar la sala."; }
    if (next === old.room) return { ...old, error };
    if (await rooms.save(code, JSON.stringify(next), old.revision)) return { room: next, revision: old.revision + 1, error };
  }
  throw new ApplicationError(409, "La sala recibió varias respuestas simultáneas. Intenta de nuevo.");
}

export async function reserveRoom(rooms: Persistence["rooms"], examName: string, hostId: string, hostName: string, questions: Question[]): Promise<string> {
  if (!questions.length) throw new ApplicationError(409, "El examen no tiene preguntas.");
  await rooms.purgeBefore(Date.now() - 7 * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const room = newRoom(code, examName, hostId, hostName, questions);
    if (await rooms.insert(code, JSON.stringify(room), Date.now())) return code;
  }
  throw new ApplicationError(503, "No se encontró un código libre. Intenta otra vez.");
}

export async function createExamRoom(store: Persistence, user: AuthUser, examId: string): Promise<string> {
  const { content } = await readLibrary(store.libraries, user);
  const exam = content.exams.find((entry) => entry.id === examId);
  if (!exam) throw new ApplicationError(404, "El examen no existe.");
  const questions = exam.questionIds.map((id) => content.questions.find((item) => item.id === id)).filter((item) => item !== undefined);
  if (!questions.length || questions.length !== exam.questionIds.length) {
    throw new ApplicationError(409, "El examen no tiene preguntas válidas.");
  }
  return reserveRoom(store.rooms, exam.name, user.id, user.name, questions);
}

export async function joinGameRoom(rooms: Persistence["rooms"], code: string, user: AuthUser): Promise<RoomView> {
  const result = await joinStoredRoom(rooms, code, user.id, user.name);
  if (result.error) throw new ApplicationError(409, result.error);
  return roomView(result.room, user.id);
}

export async function joinStoredRoom(rooms: Persistence["rooms"], code: string, userId: string, name: string): Promise<StoredRoom> {
  return update(rooms, code, (room) => joinRoom(room, userId, name));
}

export async function readStoredRoom(rooms: Persistence["rooms"], code: string): Promise<StoredRoom> {
  return update(rooms, code, (room) => room);
}

export async function loadRoomConnection(rooms: Persistence["rooms"], code: string, userId: string): Promise<StoredRoom> {
  const initial = await readStoredRoom(rooms, code);
  if (!initial.room.players.some((player) => player.id === userId)) throw new ApplicationError(403, "No perteneces a esta sala.");
  return initial;
}

export async function actOnRoom(rooms: Persistence["rooms"], code: string, userId: string, action: RoomAction): Promise<StoredRoom> {
  return update(rooms, code, (room, now) => {
    if (!room.players.some((player) => player.id === userId)) throw new Error("No perteneces a esta sala.");
    if (action.type === "sync") return room;
    if (action.type === "start") return startRoom(room, userId, now);
    if (action.type === "next") return advanceRoom(room, userId, now);
    if (action.type === "answer") return answerRoom(room, userId, action.answer, now);
    throw new Error("Acción no reconocida.");
  });
}
