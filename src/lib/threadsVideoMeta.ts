import { supabase } from '@/integrations/supabase/client';

export type ThreadsVideoMeta = { hasVideo: boolean; image?: string | null };

const cache = new Map<string, ThreadsVideoMeta>();
const inflight = new Map<string, Promise<ThreadsVideoMeta>>();

export const getCachedThreadsVideoMeta = (url: string): ThreadsVideoMeta | null =>
  cache.get(url) ?? null;

/**
 * Threads-only helper: asks the existing fetch-og edge function whether the
 * post contains a video (and its OG image). Cached per URL for the session.
 */
export const fetchThreadsVideoMeta = (url: string): Promise<ThreadsVideoMeta> => {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(url);
  if (pending) return pending;

  const request = supabase.functions
    .invoke('fetch-og', { body: { url } })
    .then(({ data, error }) => {
      if (error || !data) throw error || new Error('no og data');
      const meta: ThreadsVideoMeta = {
        hasVideo: !!((data as any).has_video ?? (data as any).meta?.has_video),
        image: (data as any).meta?.image || (data as any).image || null,
      };
      cache.set(url, meta);
      return meta;
    })
    .catch(() => {
      const meta: ThreadsVideoMeta = { hasVideo: false, image: null };
      return meta;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request;
};
