"use client";

import { useState } from "react";
import { BookOpen, Check, FileQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import type { ChangeContent, View } from "@/app/page";
import type { AnswerIndex, Area, ContentState, DraftQuestion, Question, Topic } from "@/src/domain/models";
import { deleteQuestion, saveQuestion } from "@/src/domain/content";

interface Props {
  content: ContentState; areas: Area[]; topics: Topic[]; questions: Question[];
  selectedTopicId: string; setSelectedTopicId: (id: string) => void; change: ChangeContent; onNavigate: (view: View) => void;
}
const letters = ["A", "B", "C", "D"];

export function QuestionsView({ areas, topics, questions, selectedTopicId, setSelectedTopicId, change, onNavigate }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [form, setForm] = useState<DraftQuestion>({ topicId: selectedTopicId, prompt: "", options: ["", "", "", ""], correctIndex: 0 });
  const shown = questions.filter((question) => question.topicId === selectedTopicId);
  const topic = topics.find((item) => item.id === selectedTopicId);
  function begin(question?: Question) {
    setEditId(question?.id);
    setForm(question ? { topicId: question.topicId, prompt: question.prompt, options: [...question.options], correctIndex: question.correctIndex } : { topicId: selectedTopicId, prompt: "", options: ["", "", "", ""], correctIndex: 0 });
    setFormOpen(true);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (change((state) => saveQuestion(state, form, editId), editId ? "Pregunta actualizada." : "Pregunta creada.")) {
      setSelectedTopicId(form.topicId);
      setFormOpen(false);
    }
  }
  function remove(question: Question) {
    if (window.confirm("¿Eliminar esta pregunta?")) change((state) => deleteQuestion(state, question.id), "Pregunta eliminada.");
  }
  function updateOption(index: number, value: string) {
    const options = [...form.options] as DraftQuestion["options"];
    options[index] = value;
    setForm({ ...form, options });
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">BANCO DE CONTENIDO</span><h1>Preguntas y respuestas</h1><p>Crea tarjetas de opción múltiple para estudiar y preparar exámenes.</p></div><button className="primary-button" onClick={() => begin()} disabled={!topics.length}><Plus size={18} /> Nueva pregunta</button></div>
    <div className="filter-bar"><label>Área<select value={topic?.areaId ?? ""} onChange={(event) => setSelectedTopicId(topics.find((item) => item.areaId === event.target.value)?.id ?? "")}>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Tema<select value={selectedTopicId} onChange={(event) => setSelectedTopicId(event.target.value)}>{topics.filter((item) => item.areaId === topic?.areaId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><span className="count-pill">{shown.length} {shown.length === 1 ? "pregunta" : "preguntas"}</span></div>
    {formOpen && <form className="form-panel" onSubmit={submit}><div className="form-panel-heading"><div><span className="eyebrow">EDITOR DE TARJETAS</span><h2>{editId ? "Editar pregunta" : "Nueva pregunta"}</h2></div><button type="button" className="close-button" onClick={() => setFormOpen(false)} aria-label="Cerrar">×</button></div><div className="form-grid"><label>Área<select value={topics.find((item) => item.id === form.topicId)?.areaId ?? ""} onChange={(event) => setForm({ ...form, topicId: topics.find((item) => item.areaId === event.target.value)?.id ?? "" })}>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Tema<select value={form.topicId} onChange={(event) => setForm({ ...form, topicId: event.target.value })}>{topics.filter((item) => item.areaId === topics.find((t) => t.id === form.topicId)?.areaId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><label>Pregunta<textarea autoFocus value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="Escribe la pregunta que aparecerá en la tarjeta" rows={3} /></label><div className="options-heading"><strong>Opciones de respuesta</strong><span>Marca el círculo de la respuesta correcta.</span></div><div className="option-editor">{form.options.map((option, index) => <label className={`option-edit-row ${form.correctIndex === index ? "is-correct" : ""}`} key={index}><input className="sr-only" type="radio" name="correctOption" checked={form.correctIndex === index} onChange={() => setForm({ ...form, correctIndex: index as AnswerIndex })} /><span className="option-letter">{letters[index]}</span><input aria-label={`Opción ${letters[index]}`} value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Opción ${letters[index]}`} /><span className="correct-indicator">{form.correctIndex === index ? <Check size={16} /> : null}</span></label>)}</div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar pregunta</button></div></form>}
    {!topics.length ? <div className="empty-card"><FileQuestion size={30} /><h2>Primero crea un tema</h2><p>Las preguntas se organizan dentro de los temas de tu biblioteca.</p><button className="primary-button" onClick={() => onNavigate("biblioteca")}>Ir a biblioteca</button></div> : !shown.length ? <div className="empty-card"><FileQuestion size={30} /><h2>Este tema espera su primera pregunta</h2><p>Crea una tarjeta, importa un CSV o prueba la demostración de IA.</p><button className="primary-button" onClick={() => begin()}>Crear pregunta</button></div> : <div className="question-list">{shown.map((question, index) => <article className="question-card" key={question.id}><div className="question-card-top"><span className="question-number">PREGUNTA {String(index + 1).padStart(2, "0")}</span><span className="question-topic"><BookOpen size={14} /> {topic?.name}</span><div className="icon-actions"><button onClick={() => begin(question)} aria-label="Editar pregunta"><Pencil size={17} /></button><button onClick={() => remove(question)} aria-label="Eliminar pregunta"><Trash2 size={17} /></button></div></div><h3>{question.prompt}</h3><div className="answer-grid">{question.options.map((option, optionIndex) => <span key={optionIndex} className={`answer-preview ${optionIndex === question.correctIndex ? "correct" : ""}`}><b>{letters[optionIndex]}</b>{option}{optionIndex === question.correctIndex && <Check size={16} />}</span>)}</div></article>)}</div>}
  </>;
}
