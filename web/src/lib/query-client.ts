import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'queryCache',
});

// Bump this whenever a cached query's data shape changes, so an old persisted
// cache from a previous build gets discarded instead of restored and crashing the UI.
export const CACHE_BUSTER = 'v2';
