import { advanceRoom, answerRoom, expireRoom, joinRoom, newRoom, startRoom, type Room } from "../domain/room";
import type { Question } from "../domain/models";
import { HttpError } from "./http";

export type RoomAction = { type: "start" | "next" | "sync" } | { type: "answer"; answer: number };
export interface StoredRoom { room: Room; revision: number; error?: string }

function decode(row: { data: string; revision: number }): StoredRoom {
  return { room: JSON.parse(row.data) as Room, revision: row.revision };
}

/** A compare-and-swap update keeps one authoritative score even when two Workers answer at once. */
async function update(db: D1Database, code: string, transform: (room: Room, now: number) => Room): Promise<StoredRoom> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await db.prepare("SELECT data, revision FROM rooms WHERE code = ?").bind(code).first<{ data: string; revision: number }>();
    if (!row) throw new HttpError(404, "No existe una sala con ese código.");
    const old = decode(row);
    const now = Date.now();
    const expired = expireRoom(old.room, now);
    let next = expired;
    let error: string | undefined;
    try { next = transform(expired, now); }
    catch (cause) { error = cause instanceof Error ? cause.message : "No se pudo actualizar la sala."; }
    if (next === old.room) return { ...old, error };
    const result = await db.prepare("UPDATE rooms SET data = ?, revision = revision + 1 WHERE code = ? AND revision = ?")
      .bind(JSON.stringify(next), code, old.revision).run();
    if (result.meta.changes) return { room: next, revision: old.revision + 1, error };
  }
  throw new HttpError(409, "La sala recibió varias respuestas simultáneas. Intenta de nuevo.");
}

export async function reserveRoom(db: D1Database, examName: string, hostId: string, hostName: string, questions: Question[]): Promise<string> {
  if (!questions.length) throw new HttpError(409, "El examen no tiene preguntas.");
  await db.prepare("DELETE FROM rooms WHERE created_at < ?").bind(Date.now() - 7 * 24 * 60 * 60 * 1000).run();
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const room = newRoom(code, examName, hostId, hostName, questions);
    const result = await db.prepare("INSERT OR IGNORE INTO rooms (code, data, revision, created_at) VALUES (?, ?, 0, ?)")
      .bind(code, JSON.stringify(room), Date.now()).run();
    if (result.meta.changes) return code;
  }
  throw new HttpError(503, "No se encontró un código libre. Intenta otra vez.");
}

export async function joinStoredRoom(db: D1Database, code: string, userId: string, name: string): Promise<StoredRoom> {
  return update(db, code, (room) => joinRoom(room, userId, name));
}

export async function readStoredRoom(db: D1Database, code: string): Promise<StoredRoom> {
  return update(db, code, (room) => room);
}

export async function actOnRoom(db: D1Database, code: string, userId: string, action: RoomAction): Promise<StoredRoom> {
  return update(db, code, (room, now) => {
    if (!room.players.some((player) => player.id === userId)) throw new Error("No perteneces a esta sala.");
    if (action.type === "sync") return room;
    if (action.type === "start") return startRoom(room, userId, now);
    if (action.type === "next") return advanceRoom(room, userId, now);
    if (action.type === "answer") return answerRoom(room, userId, action.answer, now);
    throw new Error("Acción no reconocida.");
  });
}
