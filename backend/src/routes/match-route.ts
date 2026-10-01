import { apiRoutes } from "./api.routes.ts";
import type { ApiRoute } from "./types.ts";

function matchPath(route: ApiRoute, pathname: string): Record<string, string> | null {
  const template = route.path.split("/");
  const segments = pathname.split("/");
  if (template.length !== segments.length) return null;
  const params: Record<string, string> = {};

  for (let i = 0; i < template.length; i++) {
    const part = template[i];
    const value = segments[i];
    if (!part.startsWith(":")) {
      if (part !== value) return null;
      continue;
    }
    const name = part.slice(1);
    if (!value || (route.constraints?.[name] && !route.constraints[name].test(value))) return null;
    params[name] = value;
  }
  return params;
}

/** Node's WebSocket upgrade and the HTTP dispatcher use the same route declarations. */
export function matchApiRoute(method: string, pathname: string): { route: ApiRoute; params: Record<string, string> } | null {
  for (const route of apiRoutes) {
    if (route.method !== method) continue;
    const params = matchPath(route, pathname);
    if (params) return { route, params };
  }
  return null;
}
