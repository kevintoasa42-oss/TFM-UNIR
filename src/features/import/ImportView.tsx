"use client";

import { useEffect, useState } from "react";
import { Check, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import type { ChangeContent, View } from "@/App";
import type { Topic } from "@/domain/models";
import { saveQuestion } from "@/domain/content";
import { csvTemplate, parseQuestionCsv, type PreviewRow } from "./csv";

interface Props {
  topics: Topic[]; selectedTopicId: string; setSelectedTopicId: (id: string) => void;
  change: ChangeContent; notify: (message: string, error?: boolean) => void; onNavigate: (view: View) => void;
}

export function ImportView({ topics, selectedTopicId, setSelectedTopicId, change, notify, onNavigate }: Props) {
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  useEffect(() => { setPreview([]); setFileName(""); }, [selectedTopicId]);
  async function readFile(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      setPreview(parseQuestionCsv(text, selectedTopicId));
      setFileName(file.name);
    } catch (error) {
      setPreview([]); setFileName("");
      notify(error instanceof Error ? error.message : "No se pudo leer el CSV.", true);
    }
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csvTemplate], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "plantilla-flashreto.csv"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const errors = preview.filter((row) => row.error).length;
  function importRows() {
    if (!preview.length || errors) return;
    const valid = preview.flatMap((row) => row.draft ? [row.draft] : []);
    if (change((state) => valid.reduce((current, draft) => saveQuestion(current, draft), state), `${valid.length} preguntas importadas correctamente.`)) {
      setPreview([]); setFileName(""); onNavigate("preguntas");
    }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">CREA EN GRANDE</span><h1>Importar preguntas</h1><p>Sube un archivo CSV, revisa cada fila y añade todas las preguntas a un tema.</p></div><button className="secondary-button" onClick={downloadTemplate}><Download size={18} /> Descargar plantilla</button></div>
    <div className="import-layout"><div className="form-panel"><div className="step-label"><span>1</span> Elige el tema</div><label>Tema de destino<select value={selectedTopicId} onChange={(event) => setSelectedTopicId(event.target.value)}>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label><div className="step-label"><span>2</span> Sube tu archivo CSV</div><label className="drop-zone"><Upload size={27} /><strong>{fileName || "Selecciona un archivo CSV"}</strong><span>Formato .csv · Las respuestas correctas se indican con A, B, C o D</span><input type="file" accept=".csv,text/csv" disabled={!selectedTopicId} onChange={(event) => readFile(event.target.files?.[0])} /></label><div className="tip-box"><strong>Columnas necesarias</strong><code>pregunta, opcion_a, opcion_b, opcion_c, opcion_d, correcta</code><span>La primera fila del archivo debe tener estos encabezados.</span></div></div><div className="import-side"><span className="import-illustration"><FileSpreadsheet size={49} /></span><h2>De tu tabla a tus tarjetas</h2><p>Descarga la plantilla, completa una pregunta por fila y comprueba las respuestas antes de guardar.</p><div className="import-example"><span>01</span><div><strong>¿Qué estudia la biología?</strong><small>A. Los seres vivos ✓</small></div></div></div></div>
    {!!preview.length && <section className="preview-panel"><div className="section-heading"><div><span className="eyebrow">PASO 3 · REVISA</span><h2>Vista previa</h2></div><span className={`count-pill ${errors ? "bad" : ""}`}>{preview.length} filas · {errors} errores</span></div><div className="preview-list">{preview.map((row) => <div className={`preview-row ${row.error ? "invalid" : ""}`} key={row.line}><span className="preview-status">{row.error ? <X size={16} /> : <Check size={16} />}</span><div><strong>Fila {row.line}: {row.prompt}</strong><small>{row.error ?? `Respuesta: ${row.draft?.options[row.draft.correctIndex]}`}</small></div></div>)}</div><div className="form-actions"><button className="secondary-button" onClick={() => { setPreview([]); setFileName(""); }}>Cancelar</button><button className="primary-button" onClick={importRows} disabled={!!errors}>Importar {preview.length} preguntas</button></div></section>}
  </>;
}
