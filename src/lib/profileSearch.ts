import { supabase } from "@/integrations/supabase/client";

export interface ProfileSearchRow {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_following: boolean;
  is_requested?: boolean;
  follows_me?: boolean;
}

/**
 * iPhone keyboards add a space after a predicted word and capitalise the first
 * letter. The search matches text exactly, so "nilesh " found nobody. Strip
 * spaces and a leading "@" before searching.
 */
export const normalizeSearchQuery = (raw: string) =>
  raw.trim().replace(/^@+/, "").trim();

/** Rows from an earlier, shorter search that still match the longer query. */
export const filterCachedRows = <T extends Pick<ProfileSearchRow, "username" | "display_name">>(
  rows: T[],
  query: string,
): T[] => {
  const q = query.toLowerCase();
  return rows.filter(
    (r) => r.username.toLowerCase().includes(q) || (r.display_name ?? "").toLowerCase().includes(q),
  );
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { rows: ProfileSearchRow[]; at: number }>();
const cacheKey = (q: string, limit: number) => `${limit}:${q.toLowerCase()}`;

/** Best instant answer while the network request runs: exact cache, else a shorter cached prefix. */
export const instantSearchRows = (query: string, limit: number): ProfileSearchRow[] | null => {
  const q = normalizeSearchQuery(query);
  if (!q) return null;
  for (let len = q.length; len >= 1; len--) {
    const hit = cache.get(cacheKey(q.slice(0, len), limit));
    if (!hit || Date.now() - hit.at > CACHE_TTL_MS) continue;
    return len === q.length ? hit.rows : filterCachedRows(hit.rows, q);
  }
  return null;
};

/**
 * On iPhone a request sent on a connection that went stale while the app was
 * in the background can hang for a minute and then fail ("No users found").
 * Give each attempt a short deadline and retry on a fresh request instead.
 */
const ATTEMPT_TIMEOUTS_MS = [4000, 6000, 9000];

export async function searchProfiles(
  query: string,
  limit: number,
  cursor: string | null = null,
): Promise<ProfileSearchRow[]> {
  const q = normalizeSearchQuery(query);
  if (!q) return [];
  let lastError: unknown;
  for (const timeoutMs of ATTEMPT_TIMEOUTS_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const { data, error } = await supabase
        .rpc("search_profiles", { q, limit_count: limit, cursor })
        .abortSignal(controller.signal);
      if (error) throw error;
      const rows = (data || []) as ProfileSearchRow[];
      if (!cursor) cache.set(cacheKey(q, limit), { rows, at: Date.now() });
      return rows;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
