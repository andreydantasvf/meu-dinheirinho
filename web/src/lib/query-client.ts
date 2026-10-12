import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Erro 4xx (ex. 404 de um registro excluído) não melhora tentando de novo — só
// atrasaria a mensagem. Checa `status` direto em vez de `instanceof ApiError`
// porque lib/api.ts já importa este módulo.
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetry } },
});

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'queryCache',
});

// Bump this whenever a cached query's data shape changes, so an old persisted
// cache from a previous build gets discarded instead of restored and crashing the UI.
export const CACHE_BUSTER = 'v2';
