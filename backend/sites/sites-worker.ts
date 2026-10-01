import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "./connector-context";
import type { ConnectorBinding } from "../../shared/sites/connector-contract.mjs";

import { api } from "../src/router";
import { d1Persistence } from "../src/adapters/d1";
import { connectRoom } from "../src/room-socket";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      if (!env.DB) return Response.json({ error: "La base de datos no está disponible." }, { status: 503 });
      const store = d1Persistence(env.DB);
      return api(request, store, (code, userId) => connectRoom(store.rooms, code, userId));
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};
