import { roomView } from "../domain/room";
import { actOnRoom, readStoredRoom, type RoomAction, type StoredRoom } from "./room-store";
import { HttpError } from "./http";
import type { Persistence } from "./persistence";

export interface RoomSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code: number, reason: string): void;
  onMessage(listener: (data: unknown) => void): void;
  onClose(listener: () => void): void;
  onError(listener: () => void): void;
}

export async function loadRoomConnection(rooms: Persistence["rooms"], code: string, userId: string): Promise<StoredRoom> {
  const initial = await readStoredRoom(rooms, code);
  if (!initial.room.players.some((player) => player.id === userId)) throw new HttpError(403, "No perteneces a esta sala.");
  return initial;
}

/** Both runtimes deliver the same protocol; the database revision coordinates all connections. */
export function attachRoomSocket(socket: RoomSocket, rooms: Persistence["rooms"], code: string, userId: string, initial: StoredRoom): void {
  let lastRevision = -1;
  let active = true;
  const send = (entry: StoredRoom) => {
    if (!active || socket.readyState !== 1 || entry.revision <= lastRevision) return;
    lastRevision = entry.revision;
    socket.send(JSON.stringify({ type: "state", room: roomView(entry.room, userId) }));
  };
  const sync = async () => {
    try { send(await readStoredRoom(rooms, code)); }
    catch { if (active) socket.close(1011, "No se pudo sincronizar la sala"); }
  };
  const timer = setInterval(() => { void sync(); }, 400);
  const stop = () => { active = false; clearInterval(timer); };
  socket.onClose(stop);
  socket.onError(stop);
  socket.onMessage((data) => {
    void (async () => {
      try {
        if (typeof data !== "string" || data.length > 2048) throw new Error("Mensaje no válido.");
        const action = JSON.parse(data) as RoomAction;
        if (!action || typeof action !== "object" || !["start", "next", "answer", "sync"].includes(action.type)) throw new Error("Acción no reconocida.");
        const result = await actOnRoom(rooms, code, userId, action);
        send(result);
        if (result.error && active && socket.readyState === 1) socket.send(JSON.stringify({ type: "error", message: result.error }));
      } catch (cause) {
        if (active && socket.readyState === 1) socket.send(JSON.stringify({ type: "error", message: cause instanceof Error ? cause.message : "No se pudo procesar el mensaje." }));
      }
    })();
  });
  send(initial);
}

export async function connectRoom(rooms: Persistence["rooms"], code: string, userId: string): Promise<Response> {
  const initial = await loadRoomConnection(rooms, code, userId);
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  attachRoomSocket({
    get readyState() { return server.readyState; },
    send: (data) => server.send(data),
    close: (code, reason) => server.close(code, reason),
    onMessage: (listener) => server.addEventListener("message", (event) => listener(event.data)),
    onClose: (listener) => server.addEventListener("close", listener),
    onError: (listener) => server.addEventListener("error", listener),
  }, rooms, code, userId, initial);
  return new Response(null, { status: 101, webSocket: client });
}
