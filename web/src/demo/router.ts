import type { DemoDb } from './types';

export type HandlerContext = {
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  db: DemoDb;
};

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Mesmo formato das rotas Express do backend, ex. `/accounts/:id/fatura`. */
  pattern: string;
  /** Retorna o JSON da resposta; `undefined` equivale a um 204. */
  handler: (ctx: HandlerContext) => unknown;
};

export function matchRoute(
  routes: Route[],
  method: string,
  pathname: string,
): { route: Route; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter(Boolean);
  for (const route of routes) {
    if (route.method !== method) continue;
    const patternParts = route.pattern.split('/').filter(Boolean);
    if (patternParts.length !== parts.length) continue;

    const params: Record<string, string> = {};
    const matches = patternParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      }
      return part === parts[i];
    });
    if (matches) return { route, params };
  }
  return null;
}
