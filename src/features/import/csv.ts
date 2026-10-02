import Papa from "papaparse";
import { questionDraftSchema } from "../../domain/content.ts";
import type { AnswerIndex, DraftQuestion } from "../../domain/models";

const headers = ["pregunta", "opcion_a", "opcion_b", "opcion_c", "opcion_d", "correcta"] as const;

export interface PreviewRow {
  line: number;
  draft: DraftQuestion | null;
  error: string | null;
  prompt: string;
}

export function parseQuestionCsv(text: string, topicId: string): PreviewRow[] {
  const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy" });
  const missing = headers.filter((header) => !result.meta.fields?.includes(header));
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}.`);
  if (result.errors.length) throw new Error(`CSV inválido: ${result.errors[0].message}`);
  if (!result.data.length) throw new Error("El archivo no contiene preguntas.");
  return result.data.map((row, index) => {
    const letter = row.correcta?.trim().toUpperCase();
    const answer = ["A", "B", "C", "D"].indexOf(letter);
    const draft: DraftQuestion = {
      topicId,
      prompt: row.pregunta?.trim() ?? "",
      options: [row.opcion_a?.trim() ?? "", row.opcion_b?.trim() ?? "", row.opcion_c?.trim() ?? "", row.opcion_d?.trim() ?? ""],
      correctIndex: answer as AnswerIndex,
    };
    const parsed = questionDraftSchema.safeParse(draft);
    const error = answer < 0 ? "La respuesta correcta debe ser A, B, C o D." : parsed.success ? null : parsed.error.issues[0]?.message ?? "Fila inválida.";
    return { line: index + 2, draft: error ? null : draft, error, prompt: draft.prompt || "(sin pregunta)" };
  });
}

export const csvTemplate = "pregunta,opcion_a,opcion_b,opcion_c,opcion_d,correcta\n¿Dónde se encuentra el ADN?,Núcleo,Ribosoma,Membrana,Lisosoma,A\n";
