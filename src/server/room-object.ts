import { DurableObject } from "cloudflare:workers";
import { advanceRoom, answerRoom, expireRoom, joinRoom, newRoom, roomView, startRoom, type Room } from "../domain/room";
import type { Question } from "../domain/models";

type Action = { type: "start" | "next" } | { type: "answer"; answer: number };

/** One Durable Object owns one room, so answers, the timer and broadcasts share a serial authority. */
export class RoomDurableObject extends DurableObject<Cloudflare.Env> {
  private async load(): Promise<Room | null> { return (await this.ctx.storage.get<Room>("room")) ?? null; }

  private async save(room: Room): Promise<void> {
    await this.ctx.storage.put("room", room);
    if (room.phase === "question" && room.endsAt) await this.ctx.storage.setAlarm(room.endsAt);
    else await this.ctx.storage.deleteAlarm();
    this.broadcast(room);
  }

  private broadcast(room: Room): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as { userId?: string } | null;
      if (!attachment?.userId) continue;
      try { socket.send(JSON.stringify({ type: "state", room: roomView(room, attachment.userId) })); }
      catch { try { socket.close(); } catch { /* already closed */ } }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    let room = await this.load();
    if (room) {
      const updated = expireRoom(room, Date.now());
      if (updated !== room) { room = updated; await this.save(room); }
    }
    if (path === "/init" && request.method === "POST") {
      if (room) return Response.json({ error: "Código ocupado." }, { status: 409 });
      const data = await request.json() as { code: string; examName: string; hostId: string; hostName: string; questions: Question[] };
      room = newRoom(data.code, data.examName, data.hostId, data.hostName, data.questions);
      await this.save(room);
      return Response.json({ code: room.code }, { status: 201 });
    }
    if (!room) return Response.json({ error: "No existe una sala con ese código." }, { status: 404 });
    if (path === "/join" && request.method === "POST") {
      const data = await request.json() as { id: string; name: string };
      try { room = joinRoom(room, data.id, data.name); await this.save(room); return Response.json({ room: roomView(room, data.id) }); }
      catch (error) { return Response.json({ error: (error as Error).message }, { status: 409 }); }
    }
    if (path === "/connect" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const userId = new URL(request.url).searchParams.get("userId") ?? "";
      if (!room.players.some((player) => player.id === userId)) return Response.json({ error: "No perteneces a esta sala." }, { status: 403 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ userId });
      server.send(JSON.stringify({ type: "state", room: roomView(room, userId) }));
      return new Response(null, { status: 101, webSocket: client });
    }
    return Response.json({ error: "Ruta de sala no encontrada." }, { status: 404 });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const userId = (socket.deserializeAttachment() as { userId?: string } | null)?.userId;
    let room = await this.load();
    if (!userId || !room || !room.players.some((player) => player.id === userId)) { socket.close(1008, "Sesión inválida"); return; }
    const expired = expireRoom(room, Date.now());
    if (expired !== room) { room = expired; await this.save(room); }
    try {
      const action = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)) as Action;
      if (action.type === "start") room = startRoom(room, userId, Date.now());
      else if (action.type === "answer") room = answerRoom(room, userId, action.answer, Date.now());
      else if (action.type === "next") room = advanceRoom(room, userId, Date.now());
      else throw new Error("Acción no reconocida.");
      await this.save(room);
    } catch (error) {
      socket.send(JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "No se pudo procesar la acción." }));
    }
  }

  async alarm(): Promise<void> {
    const room = await this.load();
    if (!room) return;
    const updated = expireRoom(room, Date.now());
    if (updated !== room) await this.save(updated);
  }
}
