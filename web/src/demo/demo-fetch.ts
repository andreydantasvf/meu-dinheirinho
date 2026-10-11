import { ApiError } from '@/lib/api';
import { DemoHttpError } from './errors';
import { matchRoute } from './router';
import { routes } from './routes';
import { getDb, saveDb } from './store';

type DemoFetchOptions = { method?: string; body?: unknown };

// Substitui a chamada HTTP no modo demo (ver src/lib/api.ts). Erros saem como ApiError com o
// mesmo status/mensagem do backend, então toasts e tratamentos da UI funcionam igual.
export async function demoFetch<T>(
  path: string,
  options: DemoFetchOptions = {},
): Promise<T> {
  const url = new URL(path, 'http://demo.local');
  const method = (options.method ?? 'GET').toUpperCase();
  const match = matchRoute(routes, method, url.pathname);
  if (!match) throw new ApiError('Rota não encontrada', 404);

  const db = getDb();
  // Ida e volta por JSON, como numa requisição real (ex.: Date vira string ISO).
  const body =
    options.body === undefined
      ? {}
      : (JSON.parse(JSON.stringify(options.body)) as Record<string, unknown>);

  try {
    // Handlers validam tudo antes de mutar o db, então um erro nunca deixa estado parcial.
    const result = match.route.handler({
      params: match.params,
      query: url.searchParams,
      body,
      db,
    });
    if (method !== 'GET') saveDb(db);
    // Cópia: o cache do TanStack Query nunca pode segurar referências do "banco".
    return (result === undefined ? undefined : structuredClone(result)) as T;
  } catch (error) {
    if (error instanceof DemoHttpError) {
      throw new ApiError(error.message, error.status);
    }
    throw error;
  }
}
