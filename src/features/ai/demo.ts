import type { AnswerIndex, DraftQuestion } from "../../domain/models";

interface Suggestion {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: AnswerIndex;
}

const examples: Record<string, Suggestion[]> = {
  biologia: [
    { prompt: "¿Qué molécula almacena la información genética?", options: ["ADN", "Glucosa", "Colágeno", "ATP"], correctIndex: 0 },
    { prompt: "¿Qué proceso permite a las plantas producir alimento con luz?", options: ["Respiración", "Fotosíntesis", "Fermentación", "Digestión"], correctIndex: 1 },
  ],
  historia: [
    { prompt: "¿En qué continente surgió la civilización egipcia?", options: ["Asia", "Europa", "África", "América"], correctIndex: 2 },
    { prompt: "¿Qué periodo siguió a la Edad Media en Europa?", options: ["Renacimiento", "Prehistoria", "Antigüedad", "Edad de Bronce"], correctIndex: 0 },
  ],
  programacion: [
    { prompt: "¿Qué tipo de dato representa verdadero o falso?", options: ["Cadena", "Booleano", "Arreglo", "Objeto"], correctIndex: 1 },
    { prompt: "¿Qué estructura guarda una secuencia de elementos?", options: ["Condición", "Comentario", "Arreglo", "Operador"], correctIndex: 2 },
  ],
};

export function suggestFromTopic(topicId: string): DraftQuestion[] {
  return (examples[topicId] ?? []).map((example) => ({ ...example, topicId }));
}

export function completeOptionsDemo(topicId: string, prompt: string, answer: string): DraftQuestion {
  const correct = answer.trim();
  if (prompt.trim().length < 5 || !correct) throw new Error("Escribe una pregunta y su respuesta correcta.");
  // Son alternativas de ejemplo para revisar y editar, no una llamada a un modelo de IA.
  return { topicId, prompt: prompt.trim(), options: [correct, "Alternativa de ejemplo 1", "Alternativa de ejemplo 2", "Alternativa de ejemplo 3"], correctIndex: 0 };
}
