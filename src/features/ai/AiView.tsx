"use client";

import { useState } from "react";
import { Check, FileQuestion, Lightbulb, Sparkles, WandSparkles } from "lucide-react";
import type { ChangeContent, View } from "@/app/page";
import type { AnswerIndex, DraftQuestion, Topic } from "@/src/domain/models";
import { saveQuestion } from "@/src/domain/content";
import { completeOptionsDemo, suggestFromTopic } from "./demo";

interface Props {
  topics: Topic[]; selectedTopicId: string; setSelectedTopicId: (id: string) => void;
  change: ChangeContent; notify: (message: string, error?: boolean) => void; onNavigate: (view: View) => void;
}
const letters = ["A", "B", "C", "D"];

export function AiView({ topics, selectedTopicId, setSelectedTopicId, change, notify, onNavigate }: Props) {
  const [mode, setMode] = useState<"tema" | "opciones">("tema");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [suggestions, setSuggestions] = useState<DraftQuestion[]>([]);
  function generate() {
    const proposed = suggestFromTopic(selectedTopicId);
    if (!proposed.length) { notify("La demo tiene ejemplos preparados para Biología celular, Historia universal y Programación básica.", true); return; }
    setSuggestions(proposed);
  }
  function complete(event: React.FormEvent) {
    event.preventDefault();
    try { setSuggestions([completeOptionsDemo(selectedTopicId, prompt, answer)]); }
    catch (error) { notify(error instanceof Error ? error.message : "Revisa los datos.", true); }
  }
  function update(index: number, draft: DraftQuestion) {
    setSuggestions((items) => items.map((item, i) => i === index ? draft : item));
  }
  function save(index: number) {
    if (change((state) => saveQuestion(state, suggestions[index]), "Propuesta revisada y guardada como pregunta.")) {
      setSuggestions((items) => items.filter((_, i) => i !== index));
    }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">IDEAS PARA CREAR</span><h1>Asistente IA <span className="title-chip">DEMO</span></h1><p>Explora dos formas de preparar preguntas y revisa las propuestas antes de guardarlas.</p></div><button className="secondary-button" onClick={() => onNavigate("preguntas")}><FileQuestion size={17} /> Ver preguntas</button></div>
    <div className="demo-callout"><Sparkles size={19} /><span><strong>Demostración con ejemplos preparados.</strong> Esta versión no contacta a un modelo de IA. Las propuestas son editables para que pruebes el flujo completo.</span></div>
    <div className="ai-tabs" role="tablist" aria-label="Modo de generación"><button role="tab" aria-selected={mode === "tema"} className={mode === "tema" ? "active" : ""} onClick={() => { setMode("tema"); setSuggestions([]); }}><WandSparkles size={18} /> Desde un tema</button><button role="tab" aria-selected={mode === "opciones"} className={mode === "opciones" ? "active" : ""} onClick={() => { setMode("opciones"); setSuggestions([]); }}><Lightbulb size={18} /> Completar opciones</button></div>
    <div className="form-panel ai-input"><div className="form-panel-heading"><div><span className="eyebrow">{mode === "tema" ? "GENERA TARJETAS" : "CREA ALTERNATIVAS"}</span><h2>{mode === "tema" ? "Empieza con un tema" : "Parte de tu pregunta"}</h2></div><span className="ai-spark"><Sparkles size={23} /></span></div>{mode === "tema" ? <><label>Tema<select value={selectedTopicId} onChange={(event) => { setSelectedTopicId(event.target.value); setSuggestions([]); }}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><p className="field-note">Hay ejemplos para Biología celular, Historia universal y Programación básica.</p><button className="primary-button" onClick={generate} disabled={!selectedTopicId}><Sparkles size={18} /> Ver propuestas</button></> : <form onSubmit={complete}><label>Tema<select value={selectedTopicId} onChange={(event) => { setSelectedTopicId(event.target.value); setSuggestions([]); }}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><div className="form-grid"><label>Pregunta<input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ej. ¿Qué es una célula?" /></label><label>Respuesta correcta<input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Ej. Unidad básica de la vida" /></label></div><p className="field-note">Las tres alternativas de muestra se pueden reemplazar en la revisión.</p><button className="primary-button" type="submit"><Sparkles size={18} /> Completar opciones</button></form>}</div>
    {!!suggestions.length && <section className="section-block"><div className="section-heading"><div><span className="eyebrow">REVISA ANTES DE GUARDAR</span><h2>{suggestions.length} {suggestions.length === 1 ? "propuesta" : "propuestas"}</h2></div></div><div className="suggestion-grid">{suggestions.map((draft, index) => <div className="form-panel suggestion-card" key={index}><span className="question-number">PROPUESTA {String(index + 1).padStart(2, "0")}</span><label>Pregunta<textarea rows={2} value={draft.prompt} onChange={(event) => update(index, { ...draft, prompt: event.target.value })} /></label><span className="field-note">Marca la opción correcta y ajusta el texto.</span><div className="option-editor">{draft.options.map((option, optionIndex) => <label className={`option-edit-row ${draft.correctIndex === optionIndex ? "is-correct" : ""}`} key={optionIndex}><input className="sr-only" type="radio" name={`correct-${index}`} checked={draft.correctIndex === optionIndex} onChange={() => update(index, { ...draft, correctIndex: optionIndex as AnswerIndex })} /><span className="option-letter">{letters[optionIndex]}</span><input aria-label={`Opción ${letters[optionIndex]}`} value={option} onChange={(event) => { const options = [...draft.options] as DraftQuestion["options"]; options[optionIndex] = event.target.value; update(index, { ...draft, options }); }} /><span className="correct-indicator">{draft.correctIndex === optionIndex && <Check size={16} />}</span></label>)}</div><button className="primary-button" onClick={() => save(index)}><Check size={17} /> Guardar pregunta</button></div>)}</div></section>}
  </>;
}
