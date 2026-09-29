"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, Copy, Crown, Play, RotateCcw, Swords, Users } from "lucide-react";
import type { View } from "@/app/page";
import type { AnswerIndex, ContentState, Exam, Question } from "@/src/domain/models";
import { answerGame, createGame, joinGame, nextGameQuestion, revealGame, startGame, type GameSession } from "@/src/domain/game";

interface Props {
  content: ContentState; exams: Exam[]; selectedExamId: string; setSelectedExamId: (id: string) => void;
  notify: (message: string, error?: boolean) => void; onNavigate: (view: View) => void;
}
const letters = ["A", "B", "C", "D"];

export function GameView({ content, exams, selectedExamId, setSelectedExamId, notify, onNavigate }: Props) {
  const [game, setGame] = useState<GameSession | null>(null);
  const [role, setRole] = useState<"host" | "guest">("host");
  const [joinCode, setJoinCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [now, setNow] = useState(Date.now());
  const exam = exams.find((item) => item.id === (game?.examId ?? selectedExamId));
  const gameQuestions = exam?.questionIds.map((id) => content.questions.find((item) => item.id === id)).filter((item): item is Question => !!item) ?? [];
  const question = gameQuestions[game?.questionIndex ?? 0];
  const remaining = game?.phase === "question" && game.endsAt ? Math.max(0, Math.ceil((game.endsAt - now) / 1000)) : 20;
  const currentPlayer = game?.players.find((item) => item.id === role);

  useEffect(() => {
    if (game?.phase !== "question") return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [game?.phase]);
  useEffect(() => {
    if (game?.phase === "question" && game.endsAt !== null && now >= game.endsAt && question) {
      setGame((current) => current && current.phase === "question" ? revealGame(current, question) : current);
    }
  }, [now, game, question]);

  function create() {
    if (!exam || !gameQuestions.length) { notify("Elige un examen con al menos una pregunta.", true); return; }
    const host = content.users.find((user) => user.id === content.currentUserId)?.name.split(" ")[0] ?? "Anfitrión";
    setGame(createGame(exam.id, host)); setRole("host"); setJoinCode(""); setGuestName("");
  }
  function join(event: React.FormEvent) {
    event.preventDefault();
    if (!game) return;
    try { setGame(joinGame(game, joinCode, guestName)); setRole("guest"); notify("Invitado unido a la sala de demostración."); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo entrar.", true); }
  }
  function start() {
    if (!game) return;
    try { const time = Date.now(); setGame(startGame(game, time)); setNow(time); setRole("host"); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo iniciar.", true); }
  }
  function answer(index: AnswerIndex) {
    if (!game || !question) return;
    const time = Date.now();
    const answered = answerGame(game, role, index, time);
    if (answered === game) { notify("Esta respuesta ya se cerró o el tiempo terminó.", true); return; }
    setGame(answered.players.every((player) => player.answer !== null) ? revealGame(answered, question) : answered);
  }
  function reveal() { if (game && question) setGame(revealGame(game, question)); }
  function next() { if (game) { const time = Date.now(); setGame(nextGameQuestion(game, gameQuestions.length, time)); setNow(time); } }
  function copyCode() { if (game) void navigator.clipboard?.writeText(game.code).then(() => notify("Código copiado."), () => notify("Copia el código mostrado.", true)); }

  return <>
    <div className="page-heading"><div><span className="eyebrow">APRENDE JUGANDO</span><h1>Partida entre dos <span className="title-chip">DEMO</span></h1><p>Comparte un código, responde preguntas y compara los puntos.</p></div>{game && <button className="secondary-button" onClick={() => setGame(null)}><RotateCcw size={17} /> Nueva sala</button>}</div>
    <div className="demo-callout"><Swords size={19} /><span><strong>Simulación en este navegador.</strong> Cambia entre anfitrión e invitado para probar ambas vistas. La sincronización entre dispositivos llegará con Socket.IO.</span></div>
    {!game && <div className="game-start-grid"><div className="form-panel"><span className="eyebrow">PASO 01 · ELIGE TU RETO</span><h2>Crear una sala</h2><p className="quiet">Selecciona un examen para empezar. Puedes invitar a otra persona con un código de seis dígitos.</p><label>Examen<select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)}>{exams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.questionIds.length} preguntas</option>)}</select></label><button className="primary-button" onClick={create} disabled={!exams.length}><PlusIcon /> Crear sala demo</button></div><div className="game-intro"><span className="game-intro-icon"><Users size={34} /></span><h2>Dos personas.<br />Un mismo reto.</h2><p>Ambos responden la misma pregunta. Cada acierto vale 100 puntos y hay 20 segundos por ronda.</p><div className="game-steps"><span><b>01</b> Crea la sala</span><span><b>02</b> Une al invitado</span><span><b>03</b> Jueguen juntos</span></div></div></div>}
    {game?.phase === "lobby" && <div className="lobby-grid"><div className="form-panel lobby-host"><span className="eyebrow">SALA DE ESPERA · ANFITRIÓN</span><h2>Tu sala está lista</h2><p>Comparte este código para unir al segundo jugador.</p><div className="room-code"><span>{game.code}</span><button onClick={copyCode} aria-label="Copiar código"><Copy size={19} /></button></div><div className="room-exam"><Swords size={18} /><span>{exam?.name}</span><small>{gameQuestions.length} preguntas</small></div><div className="player-list">{game.players.map((player) => <div key={player.id}><span className={`player-avatar ${player.id}`}>{player.name ? player.name.slice(0, 1).toUpperCase() : "?"}</span><strong>{player.name || "Esperando invitado..."}</strong><small>{player.id === "host" ? "Anfitrión" : "Invitado"}</small></div>)}</div><button className="primary-button" onClick={start} disabled={!game.players[1].name}><Play size={17} /> Comenzar partida</button></div><form className="form-panel lobby-guest" onSubmit={join}><span className="eyebrow">PASO 02 · INVITADO</span><h2>Entrar con código</h2><p>Prueba el acceso del segundo jugador aquí mismo.</p><label>Código de sala<input inputMode="numeric" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label><label>Tu apodo<input value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Ej. Alex" /></label><button className="secondary-button" type="submit" disabled={!!game.players[1].name}>Entrar a la sala <ArrowRight size={16} /></button>{game.players[1].name && <div className="joined-note"><Check size={16} /> {game.players[1].name} ya está en la sala.</div>}</form></div>}
    {(game?.phase === "question" || game?.phase === "reveal") && question && <div className="game-play"><div className="game-toolbar"><div><span className="eyebrow">{exam?.name}</span><strong>Pregunta {game.questionIndex + 1} de {gameQuestions.length}</strong></div><div className="role-switch" aria-label="Vista de jugador"><button className={role === "host" ? "active" : ""} onClick={() => setRole("host")}>Anfitrión</button><button className={role === "guest" ? "active" : ""} onClick={() => setRole("guest")}>Invitado</button></div><span className={`timer ${remaining <= 5 ? "urgent" : ""}`}><Clock3 size={18} /> {game.phase === "reveal" ? "Cerrada" : `${remaining}s`}</span></div><div className="game-progress"><div style={{ width: `${((game.questionIndex + 1) / gameQuestions.length) * 100}%` }} /></div><div className="play-card"><div className="play-question-head"><span>ELIGE LA RESPUESTA CORRECTA</span><span>{currentPlayer?.name} · {currentPlayer?.score} pts</span></div><h2>{question.prompt}</h2><div className="play-options">{question.options.map((option, index) => <button key={index} disabled={game.phase === "reveal" || currentPlayer?.answer !== null || remaining === 0} className={`${currentPlayer?.answer === index ? "selected" : ""} ${game.phase === "reveal" && index === question.correctIndex ? "correct" : ""} ${game.phase === "reveal" && currentPlayer?.answer === index && index !== question.correctIndex ? "wrong" : ""}`} onClick={() => answer(index as AnswerIndex)}><b>{letters[index]}</b><span>{option}</span>{game.phase === "reveal" && index === question.correctIndex && <Check size={20} />}</button>)}</div>{game.phase === "question" && <p className="game-hint">{currentPlayer?.answer !== null ? "Respuesta registrada. Cambia de vista para responder como el otro jugador." : "Solo puedes elegir una respuesta por ronda."}</p>}{game.phase === "reveal" && <div className="reveal-note"><Check size={18} /> La respuesta correcta es: <strong>{question.options[question.correctIndex]}</strong></div>}</div><div className="game-footer"><div className="score-board">{game.players.map((player) => <div key={player.id}><span className={`player-avatar ${player.id}`}>{player.name.slice(0, 1).toUpperCase()}</span><span><strong>{player.name}</strong><small>{player.score} pts · {player.answer === null ? "sin respuesta" : "respondió"}</small></span></div>)}</div>{role === "host" && (game.phase === "question" ? <button className="secondary-button" onClick={reveal}>Cerrar ronda</button> : <button className="primary-button" onClick={next}>{game.questionIndex + 1 === gameQuestions.length ? "Ver resultados" : "Siguiente pregunta"} <ArrowRight size={17} /></button>)}</div></div>}
    {game?.phase === "finished" && <div className="results-card"><span className="results-crown"><Crown size={37} /></span><span className="eyebrow">PARTIDA TERMINADA</span><h2>¡Buen juego!</h2><p>Así terminó el reto de {exam?.name}.</p><div className="ranking">{[...game.players].sort((a, b) => b.score - a.score).map((player, index, sorted) => <div key={player.id}><span className="rank-number">#{index > 0 && player.score === sorted[index - 1].score ? index : index + 1}</span><span className={`player-avatar ${player.id}`}>{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong><b>{player.score} pts</b></div>)}</div><button className="primary-button" onClick={() => setGame(null)}><RotateCcw size={17} /> Jugar otra vez</button><button className="subtle-link" onClick={() => onNavigate("examenes")}>Ver mis exámenes</button></div>}
  </>;
}

function PlusIcon() { return <span aria-hidden="true">＋</span>; }
