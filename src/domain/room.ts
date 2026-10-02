import type { AnswerIndex, Question } from "./models";

export type RoomPhase = "lobby" | "question" | "reveal" | "finished";
export interface RoomView {
  code: string; examName: string; phase: RoomPhase; questionIndex: number; questionCount: number;
  endsAt: number | null; isHost: boolean;
  question: { prompt: string; options: Question["options"]; correctIndex?: AnswerIndex } | null;
  players: { id: string; name: string; score: number; answered: boolean; answer?: AnswerIndex | null }[];
}

