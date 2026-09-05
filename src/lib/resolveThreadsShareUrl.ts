import { supabase } from '@/integrations/supabase/client';
import { buildThreadsEmbedSrc } from '@/components/embeds/ThreadsEmbed';

const MEMORY_CACHE = new Map<string, string>();
// Fix 1 — in-flight promise cache keyed by the original /share/... URL so N
// simultaneous mounts of the same URL produce exactly one expand-url RPC.
const IN_FLIGHT = new Map<string, Promise<string | null>>();
const STORAGE_PREFIX = 'threads-share:';

export const isThreadsShareUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    if (!/(^|\.)threads\.(net|com)$/.test(u.hostname)) return false;
    return u.pathname.startsWith('/share');
  } catch {
    return false;
  }
};

// Fix 2 — a resolved URL is only cacheable when it is a *different*, canonical
// Threads post URL that can produce a /@user/post/<id>/embed source.
const isResolvedCanonical = (input: string, resolved: unknown): resolved is string => {
  if (typeof resolved !== 'string' || !resolved) return false;
  if (resolved === input) return false;
  if (isThreadsShareUrl(resolved)) return false;
  return !!buildThreadsEmbedSrc(resolved);
};

export const getCachedThreadsShareUrl = (url: string): string | null => {
  const cached = MEMORY_CACHE.get(url);
  if (cached) return isResolvedCanonical(url, cached) ? cached : null;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + url);
    if (stored) {
      // Drop any previously poisoned entry instead of trusting it.
      if (!isResolvedCanonical(url, stored)) {
        localStorage.removeItem(STORAGE_PREFIX + url);
        return null;
      }
      MEMORY_CACHE.set(url, stored);
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
};

const requestThreadsShareUrl = async (url: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('expand-url', {
      body: { url },
    });
    const finalUrl: unknown = data?.finalUrl;
    if (error || !isResolvedCanonical(url, finalUrl)) return null;

    MEMORY_CACHE.set(url, finalUrl);
    try {
      localStorage.setItem(STORAGE_PREFIX + url, finalUrl);
    } catch {
      // ignore
    }
    return finalUrl;
  } catch {
    return null;
  }
};

export const resolveThreadsShareUrl = async (url: string): Promise<string | null> => {
  const cached = getCachedThreadsShareUrl(url);
  if (cached) return cached;

  const existing = IN_FLIGHT.get(url);
  if (existing) return existing;

  // Only the first caller invokes expand-url; every other caller awaits the
  // same promise. The entry is removed once it settles so a failed attempt
  // stays retryable.
  const pending = requestThreadsShareUrl(url).finally(() => {
    IN_FLIGHT.delete(url);
  });
  IN_FLIGHT.set(url, pending);
  return pending;
};