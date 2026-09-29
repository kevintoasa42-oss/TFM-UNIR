"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, ListChecks, Pencil, Play, Plus, Trash2 } from "lucide-react";
import type { ChangeContent, View } from "@/app/page";
import type { ContentState, Exam, Question, Topic } from "@/src/domain/models";
import { deleteExam, saveExam } from "@/src/domain/content";

interface Props {
  content: ContentState; topics: Topic[]; questions: Question[]; exams: Exam[];
  selectedTopicId: string; setSelectedTopicId: (id: string) => void; change: ChangeContent;
  onOpen: (exam: Exam, view: View) => void; onNavigate: (view: View) => void;
}

export function ExamsView({ topics, questions, exams, selectedTopicId, setSelectedTopicId, change, onOpen, onNavigate }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [topicId, setTopicId] = useState(selectedTopicId);
  const [name, setName] = useState("");
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const relevantQuestions = questions.filter((question) => question.topicId === topicId);

  function begin(exam?: Exam) {
    setEditId(exam?.id); setTopicId(exam?.topicId ?? selectedTopicId); setName(exam?.name ?? ""); setQuestionIds(exam?.questionIds ?? []); setFormOpen(true);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (change((state) => saveExam(state, topicId, name, questionIds, editId), editId ? "Examen actualizado." : "Examen creado.")) {
      setSelectedTopicId(topicId); setFormOpen(false);
    }
  }
  function toggle(id: string) {
    setQuestionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function move(id: string, direction: -1 | 1) {
    const result = [...questionIds];
    const index = result.indexOf(id), target = index + direction;
    if (target < 0 || target >= result.length) return;
    [result[index], result[target]] = [result[target], result[index]];
    setQuestionIds(result);
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">PON A PRUEBA LO APRENDIDO</span><h1>Exámenes</h1><p>Selecciona y ordena preguntas de un tema para crear un nuevo reto.</p></div><button className="primary-button" onClick={() => begin()} disabled={!topics.length}><Plus size={18} /> Crear examen</button></div>
    {formOpen && <form className="form-panel" onSubmit={submit}><div className="form-panel-heading"><div><span className="eyebrow">CREADOR DE EXÁMENES</span><h2>{editId ? "Editar examen" : "Nuevo examen"}</h2></div><button type="button" className="close-button" onClick={() => setFormOpen(false)} aria-label="Cerrar">×</button></div><div className="form-grid"><label>Nombre del examen<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Reto de biología celular" /></label><label>Tema<select value={topicId} onChange={(event) => { setTopicId(event.target.value); setQuestionIds([]); }}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label></div><div className="options-heading"><strong>Preguntas del examen</strong><span>Selecciona las preguntas; usa las flechas para definir el orden.</span></div><div className="exam-question-picker">{relevantQuestions.map((question) => <div className={`picker-row ${questionIds.includes(question.id) ? "selected" : ""}`} key={question.id}><label><input type="checkbox" checked={questionIds.includes(question.id)} onChange={() => toggle(question.id)} /><span>{question.prompt}</span></label>{questionIds.includes(question.id) && <div className="picker-order"><b>{questionIds.indexOf(question.id) + 1}</b><button type="button" onClick={() => move(question.id, -1)} disabled={questionIds.indexOf(question.id) === 0} aria-label="Subir pregunta"><ArrowUp size={15} /></button><button type="button" onClick={() => move(question.id, 1)} disabled={questionIds.indexOf(question.id) === questionIds.length - 1} aria-label="Bajar pregunta"><ArrowDown size={15} /></button></div>}</div>)}{!relevantQuestions.length && <p className="quiet">Este tema todavía no tiene preguntas. Créalas antes de guardar el examen.</p>}</div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar examen</button></div></form>}
    {!exams.length ? <div className="empty-card"><ListChecks size={30} /><h2>Prepara tu primer examen</h2><p>Elige preguntas de un mismo tema para convertirlas en un reto.</p><button className="primary-button" onClick={() => questions.length ? begin() : onNavigate("preguntas")}>{questions.length ? "Crear examen" : "Crear preguntas"}</button></div> : <div className="exam-grid">{exams.map((exam) => { const topic = topics.find((item) => item.id === exam.topicId); return <article className="exam-card" key={exam.id}><div className="exam-card-top"><span className="exam-icon"><ListChecks size={23} /></span><div className="icon-actions"><button onClick={() => begin(exam)} aria-label={`Editar ${exam.name}`}><Pencil size={17} /></button><button onClick={() => { if (window.confirm(`¿Eliminar “${exam.name}”?`)) change((state) => deleteExam(state, exam.id), "Examen eliminado."); }} aria-label={`Eliminar ${exam.name}`}><Trash2 size={17} /></button></div></div><span className="eyebrow">{topic?.name}</span><h2>{exam.name}</h2><p>{exam.questionIds.length} preguntas ordenadas · Opción múltiple</p><div className="exam-card-footer"><button className="secondary-button" onClick={() => onOpen(exam, "estudiar")}><BookOpen size={16} /> Estudiar</button><button className="primary-button" onClick={() => onOpen(exam, "partida")}><Play size={16} /> Jugar</button></div></article>; })}</div>}
  </>;
}

