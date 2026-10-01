"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, Copy, Crown, Play, RotateCcw, Swords, Users } from "lucide-react";
import type { Exam } from "@shared/domain/models";
import type { RoomView } from "@shared/domain/room";
import { apiClient, type Account } from "@/src/infrastructure/api-client";

interface Props {
  user: Account; exams: Exam[]; selectedExamId: string; setSelectedExamId: (id: string) => void;
  notify: (message: string, error?: boolean) => void;
}
const letters = ["A", "B", "C", "D"];

export function GameView({ user, exams, selectedExamId, setSelectedExamId, notify }: Props) {
  const storageKey = `flashreto-room-${user.id}`;
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const socket = useRef<WebSocket | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = room?.phase === "question" && room.endsAt ? Math.max(0, Math.ceil((room.endsAt - now) / 1000)) : 20;
  const me = room?.players.find((player) => player.id === user.id);

  useEffect(() => { setCode(sessionStorage.getItem(storageKey) ?? ""); }, [storageKey]);
  useEffect(() => {
    if (!code) { setRoom(null); return; }
    let disposed = false;
    let retry: number | undefined;
    let heartbeat: number | undefined;
    let attempts = 0;
    const connect = () => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}/api/rooms/${code}/ws`);
      socket.current = ws;
      ws.onopen = () => {
        attempts = 0; setConnected(true);
        heartbeat = window.setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "sync" })); }, 2000);
      };
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as { type: string; room?: RoomView; message?: string };
        if (message.type === "state" && message.room) { setRoom(message.room); setNow(Date.now()); }
        if (message.type === "error" && message.message) notify(message.message, true);
      };
      ws.onclose = () => {
        window.clearInterval(heartbeat);
        if (socket.current === ws) socket.current = null;
        setConnected(false);
        if (!disposed && attempts++ < 6) retry = window.setTimeout(connect, Math.min(1000 * attempts, 5000));
        else if (!disposed) notify("No se pudo conectar a la sala. Comprueba el código o vuelve a entrar.", true);
      };
      ws.onerror = () => { /* onclose handles reconnect and feedback */ };
    };
    connect();
    return () => { disposed = true; window.clearTimeout(retry); window.clearInterval(heartbeat); socket.current?.close(); socket.current = null; };
  }, [code, notify]);
  useEffect(() => {
    if (room?.phase !== "question") return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [room?.phase]);

  function enterRoom(value: string) { sessionStorage.setItem(storageKey, value); setRoom(null); setCode(value); }
  function leaveRoom() { sessionStorage.removeItem(storageKey); socket.current?.close(); setCode(""); setRoom(null); }
  function send(message: unknown) {
    if (socket.current?.readyState !== WebSocket.OPEN) { notify("La sala se está reconectando.", true); return; }
    socket.current.send(JSON.stringify(message));
  }
  async function create() {
    if (!selectedExamId) { notify("Selecciona un examen.", true); return; }
    setBusy(true);
    try { const result = await apiClient.createRoom(selectedExamId); enterRoom(result.code); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo crear la sala.", true); }
    finally { setBusy(false); }
  }
  async function join(event: React.FormEvent) {
    event.preventDefault();
    const value = joinCode.trim();
    if (!/^\d{6}$/.test(value)) { notify("El código debe tener seis dígitos.", true); return; }
    setBusy(true);
    try { await apiClient.joinRoom(value); enterRoom(value); }
    catch (error) { notify(error instanceof Error ? error.message : "No se pudo entrar a la sala.", true); }
    finally { setBusy(false); }
  }
  function copyCode() { if (code) void navigator.clipboard.writeText(code).then(() => notify("Código copiado."), () => notify("No se pudo copiar el código.", true)); }

  return <>
    <div className="page-heading"><div><span className="eyebrow">APRENDE JUGANDO</span><h1>Partida entre dos</h1><p>Comparte un código y responde en tiempo real desde dos navegadores.</p></div>{code && <button className="secondary-button" onClick={leaveRoom}><RotateCcw size={17} /> Salir de la sala</button>}</div>
    {code && <div className="connection-status" role="status"><span className={`status-dot ${connected ? "" : "offline"}`} /> {connected ? "Conectado en tiempo real" : "Conectando con la sala…"}</div>}
    {!code && <div className="game-start-grid">{user.role === "admin" && <div className="form-panel"><span className="eyebrow">ANFITRIÓN</span><h2>Crear una sala</h2><p className="quiet">Elige un examen con preguntas y comparte el código con otro usuario registrado.</p><label>Examen<select value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)}>{exams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.questionIds.length} preguntas</option>)}</select></label><button className="primary-button" onClick={() => void create()} disabled={busy || !exams.length}>Crear sala</button>{!exams.length && <p className="quiet">Crea primero un examen con al menos una pregunta.</p>}</div>}<form className="form-panel" onSubmit={join}><span className="eyebrow">PARTICIPANTE</span><h2>Entrar con código</h2><p className="quiet">Pide al administrador el código de seis dígitos de la sala.</p><label>Código de sala<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="123456" required /></label><button className="primary-button" type="submit" disabled={busy}>Unirme a la partida <ArrowRight size={17} /></button></form><div className="game-intro"><span className="game-intro-icon"><Users size={34} /></span><h2>Dos personas.<br />Un mismo reto.</h2><p>Ambos responden la misma pregunta. Cada acierto vale 100 puntos y hay 20 segundos por ronda.</p><div className="game-steps"><span><b>01</b> Crea la sala</span><span><b>02</b> Comparte el código</span><span><b>03</b> Jueguen juntos</span></div></div></div>}
    {code && !room && <div className="empty-card"><Swords size={30} /><h2>Conectando con la sala {code}</h2><p>La partida aparecerá cuando se establezca la conexión.</p><button className="secondary-button" onClick={leaveRoom}>Volver</button></div>}
    {room?.phase === "lobby" && <div className="lobby-grid"><div className="form-panel lobby-host"><span className="eyebrow">SALA DE ESPERA</span><h2>{room.isHost ? "Tu sala está lista" : "Espera al anfitrión"}</h2><p>{room.isHost ? "Comparte este código para unir al segundo jugador." : "La partida comenzará cuando el anfitrión esté listo."}</p><div className="room-code"><span>{room.code}</span><button onClick={copyCode} aria-label="Copiar código"><Copy size={19} /></button></div><div className="room-exam"><Swords size={18} /><span>{room.examName}</span><small>{room.questionCount} preguntas</small></div><div className="player-list">{room.players.map((player, index) => <div key={player.id}><span className={`player-avatar ${index ? "guest" : "host"}`}>{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong><small>{index ? "Participante" : "Anfitrión"}</small></div>)}{room.players.length === 1 && <div><span className="player-avatar guest">?</span><strong>Esperando jugador…</strong></div>}</div>{room.isHost && <button className="primary-button" onClick={() => send({ type: "start" })} disabled={room.players.length !== 2 || !connected}><Play size={17} /> Comenzar partida</button>}</div></div>}
    {room && (room.phase === "question" || room.phase === "reveal") && room.question && <div className="play-card"><div className="play-head"><span className="eyebrow">PREGUNTA {room.questionIndex + 1} DE {room.questionCount}</span><span className={`timer ${remaining <= 5 ? "urgent" : ""}`}><Clock3 size={18} /> {room.phase === "question" ? `${remaining}s` : "Solución"}</span></div><div className="play-progress"><span style={{ width: `${((room.questionIndex + 1) / room.questionCount) * 100}%` }} /></div><h2>{room.question.prompt}</h2><div className="answer-grid">{room.question.options.map((option, index) => <button key={index} className={`answer-option ${room.phase === "reveal" && index === room.question?.correctIndex ? "correct" : ""} ${room.phase === "reveal" && me?.answer === index && index !== room.question?.correctIndex ? "wrong" : ""}`} disabled={room.phase !== "question" || me?.answered || !connected} onClick={() => send({ type: "answer", answer: index })}><b>{letters[index]}</b><span>{option}</span>{room.phase === "reveal" && index === room.question?.correctIndex && <Check size={20} />}</button>)}</div>{room.phase === "question" && <p className="game-hint">{me?.answered ? "Respuesta enviada. Espera a la otra persona o al temporizador." : "Solo puedes responder una vez por ronda."}</p>}{room.phase === "reveal" && <div className="reveal-note"><Check size={18} /> Respuesta correcta: <strong>{room.question.options[room.question.correctIndex ?? 0]}</strong></div>}<div className="game-footer"><div className="score-board">{room.players.map((player, index) => <div key={player.id}><span className={`player-avatar ${index ? "guest" : "host"}`}>{player.name.slice(0, 1).toUpperCase()}</span><span><strong>{player.name}</strong><small>{player.score} pts · {player.answered ? "respondió" : "sin respuesta"}</small></span></div>)}</div>{room.isHost && room.phase === "reveal" && <button className="primary-button" onClick={() => send({ type: "next" })}>{room.questionIndex + 1 === room.questionCount ? "Ver resultados" : "Siguiente pregunta"} <ArrowRight size={17} /></button>}</div></div>}
    {room?.phase === "finished" && <div className="results-card"><span className="results-crown"><Crown size={37} /></span><span className="eyebrow">PARTIDA TERMINADA</span><h2>¡Buen juego!</h2><p>Así terminó el reto de {room.examName}.</p><div className="ranking">{[...room.players].sort((a, b) => b.score - a.score).map((player, index, sorted) => <div key={player.id}><span className="rank-number">#{index > 0 && player.score === sorted[index - 1].score ? index : index + 1}</span><span className={`player-avatar ${index ? "guest" : "host"}`}>{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong><b>{player.score} pts</b></div>)}</div><button className="primary-button" onClick={leaveRoom}><RotateCcw size={17} /> Jugar otra vez</button></div>}
  </>;
}
