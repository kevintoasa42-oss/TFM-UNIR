"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import type { View } from "@/App";
import type { Question, Topic } from "@/domain/models";

interface Props {
  topics: Topic[]; questions: Question[]; selectedTopicId: string; setSelectedTopicId: (id: string) => void; onNavigate: (view: View) => void;
}
const letters = ["A", "B", "C", "D"];

export function StudyView({ topics, questions, selectedTopicId, setSelectedTopicId, onNavigate }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { setIndex(0); setFlipped(false); }, [selectedTopicId]);
  const cards = questions.filter((question) => question.topicId === selectedTopicId);
  const safeIndex = Math.min(index, Math.max(0, cards.length - 1));
  const card = cards[safeIndex];
  return <>
    <div className="page-heading"><div><span className="eyebrow">APRENDE A TU RITMO</span><h1>Modo estudio</h1><p>Piensa la respuesta, gira la tarjeta y comprueba si acertaste.</p></div><div className="heading-control"><label>Tema<select value={selectedTopicId} onChange={(event) => setSelectedTopicId(event.target.value)}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label></div></div>
    {!card ? <div className="empty-card"><BookOpen size={30} /><h2>No hay tarjetas en este tema</h2><p>Añade preguntas para empezar a estudiar.</p><button className="primary-button" onClick={() => onNavigate("preguntas")}>Crear pregunta</button></div> : <div className="study-layout"><div className="study-progress"><span>Tarjeta {safeIndex + 1} de {cards.length}</span><div className="progress-track"><div style={{ width: `${((safeIndex + 1) / cards.length) * 100}%` }} /></div><span>{Math.round(((safeIndex + 1) / cards.length) * 100)}%</span></div><button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(!flipped)} aria-pressed={flipped} aria-label={flipped ? "Mostrar pregunta" : "Mostrar respuesta"}><span className="flashcard-meta">{flipped ? "RESPUESTA CORRECTA" : "FLASHCARD · PREGUNTA"}</span><span className="flashcard-prompt">{flipped ? card.options[card.correctIndex] : card.prompt}</span><span className="flashcard-hint"><RotateCcw size={16} /> Haz clic para {flipped ? "volver a la pregunta" : "ver la respuesta"}</span></button><div className="study-options">{card.options.map((option, optionIndex) => <span key={optionIndex} className={flipped && optionIndex === card.correctIndex ? "correct" : ""}><b>{letters[optionIndex]}</b>{option}</span>)}</div><div className="study-controls"><button className="secondary-button" disabled={safeIndex === 0} onClick={() => { setIndex(safeIndex - 1); setFlipped(false); }}><ArrowLeft size={17} /> Anterior</button><span>{safeIndex + 1} / {cards.length}</span><button className="primary-button" onClick={() => { setIndex(safeIndex === cards.length - 1 ? 0 : safeIndex + 1); setFlipped(false); }}>{safeIndex === cards.length - 1 ? "Repetir" : "Siguiente"} <ArrowRight size={17} /></button></div></div>}
  </>;
}
