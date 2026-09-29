import type { AnswerIndex, Question } from "./models";

export type RoomPhase = "lobby" | "question" | "reveal" | "finished";
export interface RoomPlayer { id: string; name: string; score: number; answer: AnswerIndex | null }
export interface Room {
  code: string; examName: string; hostId: string; phase: RoomPhase; questionIndex: number;
  questions: Question[]; endsAt: number | null; players: RoomPlayer[];
}
export interface RoomView {
  code: string; examName: string; phase: RoomPhase; questionIndex: number; questionCount: number;
  endsAt: number | null; isHost: boolean;
  question: { prompt: string; options: Question["options"]; correctIndex?: AnswerIndex } | null;
  players: { id: string; name: string; score: number; answered: boolean; answer?: AnswerIndex | null }[];
}

export function newRoom(code: string, examName: string, hostId: string, hostName: string, questions: Question[]): Room {
  if (!questions.length) throw new Error("El examen no tiene preguntas.");
  return { code, examName, hostId, phase: "lobby", questionIndex: 0, questions, endsAt: null,
    players: [{ id: hostId, name: hostName, score: 0, answer: null }] };
}

export function joinRoom(room: Room, id: string, name: string): Room {
  if (room.phase !== "lobby") throw new Error("La partida ya comenzó.");
  if (room.players.some((player) => player.id === id)) return room;
  if (room.players.length >= 2) throw new Error("La sala ya está completa.");
  return { ...room, players: [...room.players, { id, name, score: 0, answer: null }] };
}

export function startRoom(room: Room, userId: string, now: number): Room {
  if (userId !== room.hostId) throw new Error("Solo el anfitrión puede iniciar la partida.");
  if (room.phase !== "lobby" || room.players.length !== 2) throw new Error("Espera al segundo jugador.");
  return { ...room, phase: "question", endsAt: now + 20_000 };
}

export function revealRoom(room: Room): Room {
  if (room.phase !== "question") return room;
  const correct = room.questions[room.questionIndex]?.correctIndex;
  return { ...room, phase: "reveal", endsAt: null, players: room.players.map((player) => ({ ...player,
    score: player.score + (player.answer === correct ? 100 : 0) })) };
}

export function expireRoom(room: Room, now: number): Room {
  return room.phase === "question" && room.endsAt !== null && now >= room.endsAt ? revealRoom(room) : room;
}

export function answerRoom(room: Room, userId: string, answer: number, now: number): Room {
  if (room.phase !== "question" || room.endsAt === null || now >= room.endsAt) throw new Error("El tiempo de esta pregunta terminó.");
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw new Error("Elige una opción válida.");
  const player = room.players.find((item) => item.id === userId);
  if (!player) throw new Error("No perteneces a esta sala.");
  if (player.answer !== null) throw new Error("Ya respondiste esta pregunta.");
  const updated = { ...room, players: room.players.map((item) => item.id === userId ? { ...item, answer: answer as AnswerIndex } : item) };
  return updated.players.every((item) => item.answer !== null) ? revealRoom(updated) : updated;
}

export function advanceRoom(room: Room, userId: string, now: number): Room {
  if (userId !== room.hostId) throw new Error("Solo el anfitrión puede avanzar.");
  if (room.phase !== "reveal") throw new Error("Espera a que termine la pregunta.");
  if (room.questionIndex + 1 >= room.questions.length) return { ...room, phase: "finished" };
  return { ...room, phase: "question", questionIndex: room.questionIndex + 1, endsAt: now + 20_000,
    players: room.players.map((item) => ({ ...item, answer: null })) };
}

export function roomView(room: Room, userId: string): RoomView {
  const question = room.phase === "lobby" ? null : room.questions[room.questionIndex];
  return { code: room.code, examName: room.examName, phase: room.phase, questionIndex: room.questionIndex,
    questionCount: room.questions.length, endsAt: room.endsAt, isHost: userId === room.hostId,
    question: question ? { prompt: question.prompt, options: question.options,
      ...(room.phase === "reveal" || room.phase === "finished" ? { correctIndex: question.correctIndex } : {}) } : null,
    players: room.players.map((player) => ({ id: player.id, name: player.name, score: player.score,
      answered: player.answer !== null, ...(player.id === userId || room.phase === "reveal" || room.phase === "finished" ? { answer: player.answer } : {}) })) };
}
