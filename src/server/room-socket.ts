import { roomView } from "../domain/room";
import { actOnRoom, readStoredRoom, type RoomAction, type StoredRoom } from "./room-store";
import { HttpError } from "./http";

/** WebSocket delivery with D1 coordination. Each connection observes revisions from all Worker instances. */
export async function connectRoom(db: D1Database, code: string, userId: string): Promise<Response> {
  const initial = await readStoredRoom(db, code);
  if (!initial.room.players.some((player) => player.id === userId)) throw new HttpError(403, "No perteneces a esta sala.");
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  let lastRevision = -1;
  let active = true;
  const send = (entry: StoredRoom) => {
    if (!active || server.readyState !== 1 || entry.revision <= lastRevision) return;
    lastRevision = entry.revision;
    server.send(JSON.stringify({ type: "state", room: roomView(entry.room, userId) }));
  };
  const sync = async () => {
    try { send(await readStoredRoom(db, code)); }
    catch { if (active) server.close(1011, "No se pudo sincronizar la sala"); }
  };
  const timer = setInterval(() => { void sync(); }, 400);
  const stop = () => { active = false; clearInterval(timer); };
  server.addEventListener("close", stop);
  server.addEventListener("error", stop);
  server.addEventListener("message", (event) => {
    void (async () => {
      try {
        if (typeof event.data !== "string" || event.data.length > 2048) throw new Error("Mensaje no válido.");
        const action = JSON.parse(event.data) as RoomAction;
        if (!action || typeof action !== "object" || !["start", "next", "answer", "sync"].includes(action.type)) throw new Error("Acción no reconocida.");
        const result = await actOnRoom(db, code, userId, action);
        send(result);
        if (result.error && active) server.send(JSON.stringify({ type: "error", message: result.error }));
      } catch (cause) {
        if (active) server.send(JSON.stringify({ type: "error", message: cause instanceof Error ? cause.message : "No se pudo procesar el mensaje." }));
      }
    })();
  });
  send(initial);
  return new Response(null, { status: 101, webSocket: client });
}
