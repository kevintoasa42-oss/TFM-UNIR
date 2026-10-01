import { z } from "zod";
import { body, HttpError, json, parse, sameOrigin } from "../http.ts";
import type { AuthenticatedContext } from "../routes/types.ts";
import { createExamRoom, joinGameRoom } from "../services/room.service.ts";

const createSchema = z.object({ examId: z.string().uuid() });

export async function create({ request, store, user }: AuthenticatedContext): Promise<Response> {
  const { examId } = parse(createSchema, await body(request));
  return json({ code: await createExamRoom(store, user, examId) }, 201);
}

export async function join({ store, user, params }: AuthenticatedContext): Promise<Response> {
  return json({ room: await joinGameRoom(store.rooms, params.code, user) });
}

export async function websocket({ request, user, params, connectRoom }: AuthenticatedContext): Promise<Response> {
  sameOrigin(request);
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") throw new HttpError(426, "Se requiere WebSocket.");
  if (!connectRoom) throw new HttpError(426, "Usa una conexión WebSocket.");
  return connectRoom(params.code, user.id);
}
