import { clearToken, clearUserName, getToken } from './auth';
import { persister } from './query-client';

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skip attaching the stored token — required for /auth/login and the WebAuthn challenge endpoints. */
  skipAuth?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  // Comparação inline com MODE (e não via IS_DEMO importado) para o bundler eliminar este
  // import() no build normal: src/demo/ não pode entrar no bundle de produção.
  if (import.meta.env.MODE === 'demo') {
    const { demoFetch } = await import('@/demo/demo-fetch');
    return demoFetch<T>(path, { method: options.method, body: options.body });
  }

  const { skipAuth, body, headers, ...rest } = options;
  const token = skipAuth ? null : getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-api-token': token } : {}),
      ...headers,
    },
  });

  if (res.status === 401 && !skipAuth) {
    clearToken();
    clearUserName();
    persister.removeClient();
    window.location.href = '/login';
    throw new ApiError('Não autorizado', 401);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error ?? 'Erro na requisição', res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
