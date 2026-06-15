import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const CACHE_KEY = 'aelixto-query-cache';
const MAX_AGE = 14 * 24 * 60 * 60 * 1000; // 14 days
const PERSISTED_QUERY_KEYS = new Set([
  'profile',
  'discover-posts',
  'posts',
  'user-profile',
  'user-platform-tabs',
  'platform-posts',
  'saved-posts',
  'collections',
  'post-drafts',
]);

const filterPersistedQueries = (data: any) => ({
  ...data,
  clientState: {
    ...data.clientState,
    queries: data.clientState.queries.filter((query: any) =>
      PERSISTED_QUERY_KEYS.has(query.queryKey[0])
    ),
  },
});

// Create a localStorage persister for React Query
export const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: CACHE_KEY,
  throttleTime: 1000, // Only persist once per second max
  serialize: (data) => {
    // Filter out sensitive or unnecessary data before persisting
    const filtered = filterPersistedQueries(data);
    return JSON.stringify(filtered);
  },
  deserialize: (data) => filterPersistedQueries(JSON.parse(data)),
});

// Persist options for the QueryClient
export const persistOptions = {
  persister: localStoragePersister,
  maxAge: MAX_AGE,
  buster: 'v6-unified-thumbnail-preview-fields', // Clears stale profile/saved grid snapshots so preview metadata renders everywhere
};
