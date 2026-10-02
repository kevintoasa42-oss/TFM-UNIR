"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, FileQuestion, GraduationCap, LayoutDashboard, Layers3, ListChecks, LogOut, Plus, ShieldCheck, Sparkles, Swords, Upload } from "lucide-react";
import type { ContentState, Exam } from "@/domain/models";
import { apiClient, type Account } from "@/infrastructure/api-client";
import { AuthView } from "@/features/auth/AuthView";
import { UsersView } from "@/features/auth/UsersView";
import { LibraryView } from "@/features/content/LibraryView";
import { QuestionsView } from "@/features/content/QuestionsView";
import { ExamsView } from "@/features/content/ExamsView";
import { StudyView } from "@/features/study/StudyView";
import { ImportView } from "@/features/import/ImportView";
import { GameView } from "@/features/game/GameView";

export type View = "inicio" | "biblioteca" | "preguntas" | "examenes" | "estudiar" | "importar" | "partida" | "usuarios";
export type ChangeContent = (change: (state: ContentState) => ContentState, success?: string) => boolean;

const adminNav = [
  { id: "inicio", label: "Inicio", icon: LayoutDashboard },
  { id: "biblioteca", label: "Mi biblioteca", icon: Layers3 },
  { id: "preguntas", label: "Preguntas", icon: FileQuestion },
  { id: "examenes", label: "Exámenes", icon: ListChecks },
  { id: "estudiar", label: "Estudiar", icon: BookOpen },
  { id: "partida", label: "Partida", icon: Swords },
  { id: "importar", label: "Importar CSV", icon: Upload },
  { id: "usuarios", label: "Usuarios", icon: ShieldCheck },
] as const;
const userNav = [{ id: "partida", label: "Partida", icon: Swords }] as const;

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [content, setContent] = useState<ContentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("inicio");
  const [topicId, setTopicId] = useState("");
  const [examId, setExamId] = useState("");
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const revision = useRef(0);
  const saving = useRef(false);

  useEffect(() => {
    void apiClient.me().then(async ({ user }) => {
      setAccount(user);
      if (user) {
        const result = await apiClient.content();
        setContent(result.content); revision.current = result.revision;
        setView(user.role === "admin" ? "inicio" : "partida");
      }
    }).catch((error) => setNotice({ message: error instanceof Error ? error.message : "No se pudo conectar al servidor.", error: true }))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const notify = useCallback((message: string, error = false) => setNotice({ message, error }), []);
  async function onLogin(user: Account) {
    setAccount(user); setLoading(true);
    try {
      const result = await apiClient.content();
      setContent(result.content); revision.current = result.revision;
      setView(user.role === "admin" ? "inicio" : "partida");
    } catch (error) { notify(error instanceof Error ? error.message : "No se pudo cargar tu biblioteca.", true); }
    finally { setLoading(false); }
  }
  async function logout() {
    try { await apiClient.logout(); setAccount(null); setContent(null); setView("inicio"); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo cerrar la sesión.", true); }
  }

  if (loading) return <div className="loading-screen">Cargando FlashReto…</div>;
  if (!account) return <AuthView onLogin={(user) => { void onLogin(user); }} />;
  if (!content) return <div className="loading-screen">No se pudo cargar el contenido. <button onClick={() => location.reload()}>Reintentar</button></div>;
  const nav = account.role === "admin" ? adminNav : userNav;

  const areas = content.areas.filter((area) => area.ownerId === content.currentUserId);
  const topics = content.topics.filter((topic) => areas.some((area) => area.id === topic.areaId));
  const questions = content.questions.filter((question) => topics.some((topic) => topic.id === question.topicId));
  const exams = content.exams.filter((exam) => topics.some((topic) => topic.id === exam.topicId));
  const currentTopicId = topics.some((topic) => topic.id === topicId) ? topicId : topics[0]?.id ?? "";
  const currentExamId = exams.some((exam) => exam.id === examId) ? examId : exams[0]?.id ?? "";
  const user = content.users.find((item) => item.id === content.currentUserId) ?? content.users[0];

  const change: ChangeContent = (operation, success) => {
    if (saving.current) { notify("Espera a que se guarde el cambio anterior.", true); return false; }
    try {
      const next = operation(content);
      setContent(next); saving.current = true;
      void apiClient.saveContent(next, revision.current).then((result) => {
        revision.current = result.revision; setContent(result.content);
        if (success) notify(success);
      }).catch(async (error) => {
        notify(error instanceof Error ? error.message : "No se pudo guardar el cambio.", true);
        try { const fresh = await apiClient.content(); revision.current = fresh.revision; setContent(fresh.content); }
        catch { setContent(content); }
      }).finally(() => { saving.current = false; });
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar el cambio.", true);
      return false;
    }
  };
  const openTopic = (id: string, destination: View) => { setTopicId(id); setView(destination); };
  const openExam = (exam: Exam, destination: View) => { setExamId(exam.id); setTopicId(exam.topicId); setView(destination); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("inicio")} aria-label="Ir al inicio">
          <span className="brand-mark"><GraduationCap size={23} strokeWidth={2.4} /></span>
          <span>flash<span className="brand-accent">reto</span><small>APRENDE JUGANDO</small></span>
        </button>
        <div className="nav-label">ESPACIO DE TRABAJO</div>
        <nav className="main-nav" aria-label="Navegación principal">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}>
              <Icon size={19} strokeWidth={2} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><Sparkles size={18} /><strong>Una idea, mil preguntas</strong><p>Crea, practica y reta a otra persona.</p></div>
          <div className="profile"><span className="avatar" style={{ background: user.color }}>{user.initials}</span><span><strong>{user.name}</strong><small>{account.role === "admin" ? "Administrador" : "Usuario"}</small></span></div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span className="breadcrumb">FlashReto <span>/</span> <strong>{nav.find((item) => item.id === view)?.label}</strong></span>
          <div className="top-actions"><span className="demo-badge"><span className="status-dot" /> En línea</span><button className="logout-button" onClick={() => void logout()}><LogOut size={16} /> Cerrar sesión</button></div>
        </header>
        <nav className="mobile-nav" aria-label="Navegación móvil">{nav.map(({ id, label }) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</nav>
        <main className="page-content">
          {account.role === "admin" && view === "inicio" && <Dashboard content={content} userName={user.name.split(" ")[0]} areas={areas} topics={topics} questions={questions.length} exams={exams} onNavigate={setView} onTopic={openTopic} onExam={openExam} />}
          {account.role === "admin" && view === "biblioteca" && <LibraryView content={content} areas={areas} topics={topics} questions={questions} exams={exams} change={change} onTopic={openTopic} />}
          {account.role === "admin" && view === "preguntas" && <QuestionsView content={content} areas={areas} topics={topics} questions={questions} selectedTopicId={currentTopicId} setSelectedTopicId={setTopicId} change={change} onNavigate={setView} />}
          {account.role === "admin" && view === "examenes" && <ExamsView content={content} topics={topics} questions={questions} exams={exams} selectedTopicId={currentTopicId} setSelectedTopicId={setTopicId} change={change} onOpen={openExam} onNavigate={setView} />}
          {account.role === "admin" && view === "estudiar" && <StudyView topics={topics} questions={questions} selectedTopicId={currentTopicId} setSelectedTopicId={setTopicId} onNavigate={setView} />}
          {account.role === "admin" && view === "importar" && <ImportView topics={topics} selectedTopicId={currentTopicId} setSelectedTopicId={setTopicId} change={change} notify={notify} onNavigate={setView} />}
          {account.role === "admin" && view === "usuarios" && <UsersView current={account} notify={notify} />}
          {view === "partida" && <GameView user={account} exams={exams} selectedExamId={currentExamId} setSelectedExamId={setExamId} notify={notify} />}
        </main>
      </div>
      {notice && <div className={`toast ${notice.error ? "error" : ""}`} role="status">{notice.message}</div>}
    </div>
  );
}

function Dashboard({ content, userName, areas, topics, questions, exams, onNavigate, onTopic, onExam }: {
  content: ContentState; userName: string; areas: ContentState["areas"]; topics: ContentState["topics"]; questions: number; exams: Exam[];
  onNavigate: (view: View) => void; onTopic: (id: string, view: View) => void; onExam: (exam: Exam, view: View) => void;
}) {
  return <>
    <div className="welcome-row"><div><div className="eyebrow">TU ESPACIO DE APRENDIZAJE <span className="eyebrow-line" /></div><h1>Hola, {userName} <span className="wave">✳</span></h1><p>Todo lo que necesitas para crear, estudiar y jugar en un solo lugar.</p></div><button className="primary-button" onClick={() => onNavigate("preguntas")}><Plus size={18} /> Crear pregunta</button></div>
    <section className="hero-grid" aria-label="Acciones principales"><div className="hero-card"><div className="hero-content"><span className="hero-kicker">TU PRÓXIMO RETO EMPIEZA AQUÍ</span><h2>Aprender se disfruta más cuando juegas.</h2><p>Organiza tus ideas en tarjetas, prepara exámenes y reta a alguien a responder contigo.</p><button onClick={() => onNavigate("partida")}>Iniciar partida <span>↗</span></button></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-card card-back"><span>?</span></div><div className="art-card card-front"><span className="art-mini">FLASHCARD</span><span className="art-question">¿Listo para<br />aprender?</span><span className="art-check">✓</span></div><span className="art-star star-one">✦</span><span className="art-star star-two">✳</span></div></div><div className="quick-card"><span className="quick-icon"><BookOpen size={25} /></span><span className="quick-tag">MODO ESTUDIO</span><h3>Un poco cada día hace la diferencia.</h3><p>Repasa tus tarjetas a tu ritmo y comprueba cuánto recuerdas.</p><button className="text-button" onClick={() => onNavigate("estudiar")}>Ir a estudiar <span>→</span></button></div></section>
    <section className="stats-grid" aria-label="Resumen de contenido"><div className="stat-card"><span className="stat-icon purple"><Layers3 size={21} /></span><div><strong>{areas.length}</strong><span>Áreas creadas</span></div></div><div className="stat-card"><span className="stat-icon orange"><BookOpen size={21} /></span><div><strong>{topics.length}</strong><span>Temas activos</span></div></div><div className="stat-card"><span className="stat-icon mint"><FileQuestion size={21} /></span><div><strong>{questions}</strong><span>Preguntas listas</span></div></div><div className="stat-card"><span className="stat-icon blue"><ListChecks size={21} /></span><div><strong>{exams.length}</strong><span>Exámenes</span></div></div></section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">ORGANIZA TUS IDEAS</span><h2>Explora tus temas</h2></div><button className="subtle-link" onClick={() => onNavigate("biblioteca")}>Ver biblioteca <span>→</span></button></div><div className="topic-grid">{topics.length ? topics.slice(0, 3).map((topic) => { const area = areas.find((item) => item.id === topic.areaId); const count = content.questions.filter((question) => question.topicId === topic.id).length; return <button key={topic.id} className="topic-card" onClick={() => onTopic(topic.id, "preguntas")}><span className={`topic-symbol ${area?.color ?? "purple"}`}>{area?.icon ?? "✦"}</span><span className="topic-count">{count} {count === 1 ? "pregunta" : "preguntas"}</span><strong>{topic.name}</strong><span className="topic-description">{topic.description || "Un espacio para tus preguntas."}</span><span className="topic-footer">{area?.name}<span>↗</span></span></button>; }) : <div className="empty-state">Aún no tienes temas. <button onClick={() => onNavigate("biblioteca")}>Crea tu primera área</button>.</div>}</div></section>
    <section className="section-block"><div className="section-heading"><div><span className="eyebrow">LISTOS PARA JUGAR</span><h2>Tus exámenes</h2></div><button className="subtle-link" onClick={() => onNavigate("examenes")}>Ver todos <span>→</span></button></div><div className="exam-strip">{exams.slice(0, 2).map((exam) => <div className="exam-mini" key={exam.id}><span className="exam-mini-icon"><ListChecks size={22} /></span><div><strong>{exam.name}</strong><small>{exam.questionIds.length} preguntas · {topics.find((topic) => topic.id === exam.topicId)?.name}</small></div><button onClick={() => onExam(exam, "partida")} aria-label={`Jugar ${exam.name}`}>Jugar <span>→</span></button></div>)}{!exams.length && <div className="empty-state">Crea un examen para comenzar una partida.</div>}</div></section>
  </>;
}
