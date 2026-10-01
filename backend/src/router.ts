import { errorResponse, json, sameOrigin } from "./http.ts";
import { requireAdmin, requireUser } from "./middleware/auth.middleware.ts";
import type { Persistence } from "./persistence.ts";
import { matchApiRoute } from "./routes/match-route.ts";
import type { PublicContext } from "./routes/types.ts";

/** Dispatch only: HTTP validation belongs to controllers and business rules to services. */
export async function api(request: Request, store: Persistence, connectRoom?: PublicContext["connectRoom"], options: Pick<PublicContext, "passwordIterations"> = {}): Promise<Response> {
  try {
    if (request.method !== "GET") sameOrigin(request);
    const match = matchApiRoute(request.method, new URL(request.url).pathname);
    if (!match) {
      // Preserve the existing API: unknown protected paths require a session before returning 404.
      await requireUser(store.sessions, request);
      return json({ error: "Ruta no encontrada." }, 404);
    }
    const { route, params } = match;
    const context: PublicContext = { request, store, params, connectRoom, passwordIterations: options.passwordIterations };
    if (route.access === "public") return await route.handler(context);

    const user = await requireUser(store.sessions, request);
    if (route.access === "admin") requireAdmin(user);
    return await route.handler({ ...context, user });
  } catch (error) {
    return errorResponse(error);
  }
}
