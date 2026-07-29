import { supabase } from '@/integrations/supabase/client';

/**
 * Threads' newer share links (https://www.threads.com/share/<code>/) carry no
 * author/post id, so they cannot be converted to an embed URL client-side —
 * the canonical /@user/post/<id> target only exists in a cross-origin 302
 * Location header the browser will not expose. They are resolved server-side
 * with the existing `expand-url` edge function (redirect: follow) and cached.
 */

const STORAGE_PREFIX = 'threads-share-url:';
const memoryCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export const isThreadsShareUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (!/(^|\.)threads\.(net|com)$/.test(u.hostname)) return false;
    return /^\/share\/[^/]+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
};

export const getCachedThreadsShareUrl = (url: string): string | null => {
  const cached = memoryCache.get(url);
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + url);
    if (stored) {
      memoryCache.set(url, stored);
      return stored;
    }
  } catch {
    // ignore storage errors (private mode / webview)
  }
  return null;
};

export const resolveThreadsShareUrl = (url: string): Promise<string | null> => {
  const cached = getCachedThreadsShareUrl(url);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(url);
  if (existing) return existing;

  const request = supabase.functions
    .invoke('expand-url', { body: { url } })
    .then(({ data }) => {
      const finalUrl = typeof data?.finalUrl === 'string' ? data.finalUrl : null;
      if (!finalUrl || !/\/@[^/]+\/post\/[A-Za-z0-9_-]+/.test(finalUrl)) return null;
      memoryCache.set(url, finalUrl);
      try {
        localStorage.setItem(STORAGE_PREFIX + url, finalUrl);
      } catch {
        // ignore storage errors
      }
      return finalUrl;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request;
};
