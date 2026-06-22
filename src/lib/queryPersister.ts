import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const CACHE_KEY = 'aelixto-query-cache';
const MAX_AGE = 14 * 24 * 60 * 60 * 1000; // 14 days

// Create a localStorage persister for React Query
export const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: CACHE_KEY,
  throttleTime: 1000, // Only persist once per second max
  serialize: (data) => {
    // Filter out sensitive or unnecessary data before persisting
    const filtered = {
      ...data,
      clientState: {
        ...data.clientState,
        queries: data.clientState.queries.filter((query) => {
          // Only persist feed and profile data, not session
          const key = query.queryKey[0];
          return key === 'following-feed' ||
                 key === 'profile' || 
                 key === 'discover-posts' ||
                 key === 'posts' ||
                 key === 'user-profile' ||
                 key === 'user-platform-tabs' ||
                 key === 'platform-posts' ||
                 key === 'saved-posts' ||
                 key === 'collections' ||
                 key === 'post-drafts';
        }),
      },
    };
    return JSON.stringify(filtered);
  },
  deserialize: (data) => JSON.parse(data),
});

// Persist options for the QueryClient
export const persistOptions = {
  persister: localStoragePersister,
  maxAge: MAX_AGE,
  buster: 'v9-atomic-feed-refresh-v3', // Clear stale feed caches from earlier refresh/cursor implementations
};
