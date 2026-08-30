import { supabase } from '@/integrations/supabase/client';

const MEMORY_CACHE = new Map<string, string>();
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

export const getCachedThreadsShareUrl = (url: string): string | null => {
  const cached = MEMORY_CACHE.get(url);
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + url);
    if (stored) {
      MEMORY_CACHE.set(url, stored);
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
};

export const resolveThreadsShareUrl = async (url: string): Promise<string | null> => {
  const cached = getCachedThreadsShareUrl(url);
  if (cached) return cached;

  try {
    const { data, error } = await supabase.functions.invoke('expand-url', {
      body: { url },
    });
    const finalUrl: string | undefined = data?.finalUrl;
    if (error || !finalUrl) return null;

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