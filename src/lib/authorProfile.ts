import { supabase } from "@/integrations/supabase/client";

/** The public profile fields every post header needs. */
export interface AuthorProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

const RETRY_DELAYS_MS = [400, 1200];
/** Short-lived, so a renamed account or new photo shows up within minutes. */
const KNOWN_TTL_MS = 5 * 60 * 1000;
const known = new Map<string, { profile: AuthorProfile; at: number }>();

const lookup = (userId: string) => {
  const hit = known.get(userId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > KNOWN_TTL_MS) {
    known.delete(userId);
    return undefined;
  }
  return hit.profile;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries transient failures (a dropped connection right after the phone wakes the app). */
export async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_DELAYS_MS.length) await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

export const rememberAuthorProfile = (profile: AuthorProfile | null | undefined) => {
  if (profile?.user_id && profile.username) known.set(profile.user_id, { profile, at: Date.now() });
};

export const knownAuthorProfile = (userId: string | null | undefined) =>
  (userId ? lookup(userId) : undefined) ?? null;

/**
 * Looks up post authors. A failed lookup throws (after retries) instead of
 * resolving to nothing, so a passing network hiccup can never be remembered
 * as an author called "Unknown".
 */
export async function fetchAuthorProfiles(userIds: string[]): Promise<Map<string, AuthorProfile>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, AuthorProfile>();
  const missing = ids.filter((id) => {
    const hit = lookup(id);
    if (hit) result.set(id, hit);
    return !hit;
  });
  if (!missing.length) return result;

  const rows = await withRetry(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", missing);
    if (error) throw error;
    return (data || []) as AuthorProfile[];
  });
  rows.forEach((row) => {
    rememberAuthorProfile(row);
    result.set(row.user_id, row);
  });
  return result;
}

export async function fetchAuthorProfile(userId: string): Promise<AuthorProfile | null> {
  return (await fetchAuthorProfiles([userId])).get(userId) ?? null;
}
