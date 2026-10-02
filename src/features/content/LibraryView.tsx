"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import type { ChangeContent, View } from "@/App";
import type { Area, ContentState, Exam, Question, Topic } from "@/domain/models";
import { deleteArea, deleteTopic, saveArea, saveTopic } from "@/domain/content";

interface Props {
  content: ContentState; areas: Area[]; topics: Topic[]; questions: Question[]; exams: Exam[];
  change: ChangeContent; onTopic: (id: string, view: View) => void;
}

export function LibraryView({ content, areas, topics, questions, exams, change, onTopic }: Props) {
  const [areaForm, setAreaForm] = useState(false);
  const [areaId, setAreaId] = useState<string | undefined>();
  const [areaName, setAreaName] = useState("");
  const [areaColor, setAreaColor] = useState("lavender");
  const [topicForm, setTopicForm] = useState(false);
  const [topicId, setTopicId] = useState<string | undefined>();
  const [topicAreaId, setTopicAreaId] = useState(areas[0]?.id ?? "");
  const [topicName, setTopicName] = useState("");
  const [description, setDescription] = useState("");

  function editArea(area?: Area) {
    setAreaId(area?.id); setAreaName(area?.name ?? ""); setAreaColor(area?.color ?? "lavender"); setAreaForm(true);
  }
  function editTopic(topic?: Topic, areaId?: string) {
    setTopicId(topic?.id); setTopicAreaId(topic?.areaId ?? areaId ?? areas[0]?.id ?? "");
    setTopicName(topic?.name ?? ""); setDescription(topic?.description ?? ""); setTopicForm(true);
  }
  function submitArea(event: React.FormEvent) {
    event.preventDefault();
    if (change((state) => saveArea(state, areaName, "✦", areaColor, areaId), areaId ? "Área actualizada." : "Área creada.")) setAreaForm(false);
  }
  function submitTopic(event: React.FormEvent) {
    event.preventDefault();
    if (change((state) => saveTopic(state, topicAreaId, topicName, description, topicId), topicId ? "Tema actualizado." : "Tema creado.")) setTopicForm(false);
  }
  function removeArea(area: Area) {
    if (window.confirm(`¿Eliminar el área “${area.name}”?`)) change((state) => deleteArea(state, area.id), "Área eliminada.");
  }
  function removeTopic(topic: Topic) {
    if (window.confirm(`¿Eliminar el tema “${topic.name}”?`)) change((state) => deleteTopic(state, topic.id), "Tema eliminado.");
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">CONTENIDO ORGANIZADO</span><h1>Mi biblioteca</h1><p>Organiza tus áreas y temas para encontrar cada pregunta en su lugar.</p></div><button className="primary-button" onClick={() => editArea()}><Plus size={18} /> Nueva área</button></div>
    <div className="library-summary"><span><strong>{areas.length}</strong> áreas</span><span><strong>{topics.length}</strong> temas</span><span><strong>{questions.length}</strong> preguntas</span><span><strong>{exams.length}</strong> exámenes</span></div>
    {areaForm && <form className="form-panel" onSubmit={submitArea}><div className="form-panel-heading"><div><span className="eyebrow">BIBLIOTECA</span><h2>{areaId ? "Editar área" : "Nueva área"}</h2></div><button type="button" className="close-button" onClick={() => setAreaForm(false)} aria-label="Cerrar">×</button></div><div className="form-grid"><label>Nombre del área<input autoFocus value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="Ej. Ciencias naturales" /></label><label>Color de identificación<select value={areaColor} onChange={(event) => setAreaColor(event.target.value)}><option value="lavender">Violeta</option><option value="mint">Verde</option><option value="peach">Naranja</option><option value="blue">Azul</option></select></label></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setAreaForm(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar área</button></div></form>}
    {topicForm && <form className="form-panel" onSubmit={submitTopic}><div className="form-panel-heading"><div><span className="eyebrow">BIBLIOTECA</span><h2>{topicId ? "Editar tema" : "Nuevo tema"}</h2></div><button type="button" className="close-button" onClick={() => setTopicForm(false)} aria-label="Cerrar">×</button></div><div className="form-grid"><label>Área<select value={topicAreaId} onChange={(event) => setTopicAreaId(event.target.value)}>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Nombre del tema<input autoFocus value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="Ej. Biología celular" /></label></div><label>Descripción breve<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="¿Qué aprenderás en este tema?" /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setTopicForm(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar tema</button></div></form>}
    {!areas.length && <div className="empty-card"><FolderPlus size={30} /><h2>Tu biblioteca comienza aquí</h2><p>Crea un área y después añade temas y preguntas.</p><button className="primary-button" onClick={() => editArea()}>Crear área</button></div>}
    <div className="library-grid">{areas.map((area) => { const areaTopics = topics.filter((topic) => topic.areaId === area.id); return <section className="library-card" key={area.id}><div className="library-card-head"><span className={`topic-symbol ${area.color}`}>{area.icon}</span><div><small>ÁREA DE ESTUDIO</small><h2>{area.name}</h2></div><div className="icon-actions"><button onClick={() => editArea(area)} aria-label={`Editar ${area.name}`}><Pencil size={17} /></button><button onClick={() => removeArea(area)} aria-label={`Eliminar ${area.name}`}><Trash2 size={17} /></button></div></div><div className="library-topic-list">{areaTopics.map((topic) => <div className="library-topic" key={topic.id}><button className="library-topic-main" onClick={() => onTopic(topic.id, "preguntas")}><BookOpen size={18} /><span><strong>{topic.name}</strong><small>{questions.filter((question) => question.topicId === topic.id).length} preguntas · {exams.filter((exam) => exam.topicId === topic.id).length} {exams.filter((exam) => exam.topicId === topic.id).length === 1 ? "examen" : "exámenes"}</small></span><ArrowRight size={17} /></button><div className="icon-actions"><button onClick={() => editTopic(topic)} aria-label={`Editar ${topic.name}`}><Pencil size={16} /></button><button onClick={() => removeTopic(topic)} aria-label={`Eliminar ${topic.name}`}><Trash2 size={16} /></button></div></div>)}{!areaTopics.length && <p className="quiet">Esta área todavía no tiene temas.</p>}</div><button className="inline-add" onClick={() => editTopic(undefined, area.id)}><Plus size={16} /> Añadir tema</button></section>; })}</div>
    {!!areas.length && <p className="footnote">Las áreas y temas con contenido se protegen para evitar borrados accidentales.</p>}
  </>;
}

