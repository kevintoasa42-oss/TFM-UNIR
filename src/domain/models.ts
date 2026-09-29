export type AnswerIndex = 0 | 1 | 2 | 3;

export interface User {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Area {
  id: string;
  ownerId: string;
  name: string;
  icon: string;
  color: string;
}

export interface Topic {
  id: string;
  areaId: string;
  name: string;
  description: string;
}

export interface Question {
  id: string;
  topicId: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: AnswerIndex;
}

export interface Exam {
  id: string;
  topicId: string;
  name: string;
  questionIds: string[];
}

export interface ContentState {
  users: User[];
  currentUserId: string;
  areas: Area[];
  topics: Topic[];
  questions: Question[];
  exams: Exam[];
}

export interface DraftQuestion {
  topicId: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: AnswerIndex;
}
