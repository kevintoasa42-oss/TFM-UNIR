import { z } from "zod";
import type { ContentState } from "../domain/models";
import { seedContent } from "./seed.ts";

const key = "flashreto-content-v1";
const storedSchema = z.object({
  users: z.array(z.object({ id: z.string(), name: z.string(), initials: z.string(), color: z.string() })),
  currentUserId: z.string(),
  areas: z.array(z.object({ id: z.string(), ownerId: z.string(), name: z.string(), icon: z.string(), color: z.string() })),
  topics: z.array(z.object({ id: z.string(), areaId: z.string(), name: z.string(), description: z.string() })),
  questions: z.array(z.object({ id: z.string(), topicId: z.string(), prompt: z.string(), options: z.tuple([z.string(), z.string(), z.string(), z.string()]), correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) })),
  exams: z.array(z.object({ id: z.string(), topicId: z.string(), name: z.string(), questionIds: z.array(z.string()) })),
});

export interface ContentRepository {
  load(): ContentState;
  save(state: ContentState): void;
}

export const browserContentRepository: ContentRepository = {
  load() {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return structuredClone(seedContent);
      const parsed = storedSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : structuredClone(seedContent);
    } catch {
      return structuredClone(seedContent);
    }
  },
  save(state) {
    localStorage.setItem(key, JSON.stringify(state));
  },
};
