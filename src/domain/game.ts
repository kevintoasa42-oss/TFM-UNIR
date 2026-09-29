import type { AnswerIndex, Question } from "./models";

export type GamePhase = "lobby" | "question" | "reveal" | "finished";
export interface Player {
  id: "host" | "guest";
  name: string;
  score: number;
  answer: AnswerIndex | null;
}
export interface GameSession {
  code: string;
  examId: string;
  phase: GamePhase;
  questionIndex: number;
  endsAt: number | null;
  players: [Player, Player];
}

export function createGame(examId: string, hostName: string): GameSession {
  return {
    code: Math.floor(100000 + Math.random() * 900000).toString(),
    examId,
    phase: "lobby",
    questionIndex: 0,
    endsAt: null,
    players: [
      { id: "host", name: hostName, score: 0, answer: null },
      { id: "guest", name: "", score: 0, answer: null },
    ],
  };
}

export function joinGame(game: GameSession, code: string, guestName: string): GameSession {
  if (game.phase !== "lobby" || code !== game.code) throw new Error("El código no corresponde a una sala abierta.");
  if (!guestName.trim()) throw new Error("Escribe un apodo para entrar.");
  return { ...game, players: [game.players[0], { ...game.players[1], name: guestName.trim() }] };
}

export function startGame(game: GameSession, now: number): GameSession {
  if (game.phase !== "lobby" || !game.players[1].name) throw new Error("Espera a que entre el segundo jugador.");
  return { ...game, phase: "question", endsAt: now + 20_000 };
}

export function answerGame(game: GameSession, playerId: Player["id"], answer: AnswerIndex, now: number): GameSession {
  if (game.phase !== "question" || game.endsAt === null || now >= game.endsAt) return game;
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return game;
  const player = game.players.find((item) => item.id === playerId);
  if (!player || player.answer !== null) return game;
  const players = game.players.map((item) => item.id === playerId ? { ...item, answer } : item) as [Player, Player];
  return { ...game, players };
}

export function revealGame(game: GameSession, question: Question): GameSession {
  if (game.phase !== "question") return game;
  return {
    ...game,
    phase: "reveal",
    endsAt: null,
    players: game.players.map((player) => ({ ...player, score: player.score + (player.answer === question.correctIndex ? 100 : 0) })) as [Player, Player],
  };
}

export function nextGameQuestion(game: GameSession, count: number, now: number): GameSession {
  if (game.phase !== "reveal") return game;
  if (game.questionIndex + 1 >= count) return { ...game, phase: "finished" };
  return {
    ...game,
    phase: "question",
    questionIndex: game.questionIndex + 1,
    endsAt: now + 20_000,
    players: game.players.map((player) => ({ ...player, answer: null })) as [Player, Player],
  };
}
