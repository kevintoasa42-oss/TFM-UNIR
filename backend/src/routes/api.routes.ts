import * as auth from "../controllers/auth.controller.ts";
import * as content from "../controllers/content.controller.ts";
import * as health from "../controllers/health.controller.ts";
import * as rooms from "../controllers/rooms.controller.ts";
import * as users from "../controllers/users.controller.ts";
import type { ApiRoute } from "./types.ts";

const roomCode = { code: /^\d{6}$/ };

/** Method + URL + access + controller: the complete API map lives here. */
export const apiRoutes: readonly ApiRoute[] = [
  { method: "GET", path: "/api/health", access: "public", handler: health.read },
  { method: "GET", path: "/api/me", access: "public", handler: auth.me },
  { method: "POST", path: "/api/register", access: "public", handler: auth.register },
  { method: "POST", path: "/api/login", access: "public", handler: auth.login },
  { method: "POST", path: "/api/logout", access: "public", handler: auth.logout },
  { method: "GET", path: "/api/content", access: "authenticated", handler: content.read },
  { method: "PUT", path: "/api/content", access: "admin", handler: content.save },
  { method: "GET", path: "/api/users", access: "admin", handler: users.list },
  { method: "PATCH", path: "/api/users/:id", access: "admin", handler: users.setRole },
  { method: "POST", path: "/api/rooms", access: "admin", handler: rooms.create },
  { method: "POST", path: "/api/rooms/:code/join", constraints: roomCode, access: "authenticated", handler: rooms.join },
  { method: "GET", path: "/api/rooms/:code/ws", constraints: roomCode, access: "authenticated", transport: "websocket", handler: rooms.websocket },
];
