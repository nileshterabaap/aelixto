import type { QueryClient, QueryKey } from "@tanstack/react-query";

type ProfileLike = {
  user_id?: string | null;
  aelix_score?: number | null;
  updated_at?: string | null;
};

let queryClient: QueryClient | null = null;

export function registerAelixScoreQueryClient(client: QueryClient) {
  queryClient = client;
}

const getHourlyEventKey = (eventKey: string) => {
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  return `aelix-score-optimistic:${eventKey}:${hourBucket}`;
};

const hasOptimisticallyCounted = (eventKey: string) => {
  try {
    const storageKey = getHourlyEventKey(eventKey);
    if (localStorage.getItem(storageKey) === "1") return true;
    localStorage.setItem(storageKey, "1");
  } catch {
    // Storage can be unavailable in private modes; backend dedupe still applies.
  }
  return false;
};

const bumpProfile = <T,>(value: T, authorUserId: string): T => {
  if (!value || typeof value !== "object") return value;

  const profile = value as ProfileLike;
  if (profile.user_id !== authorUserId) return value;

  return {
    ...(value as Record<string, unknown>),
    aelix_score: Number(profile.aelix_score || 0) + 1,
    updated_at: new Date().toISOString(),
  } as T;
};

export function optimisticallyBumpAelixScore(authorUserId?: string | null, eventKey?: string) {
  if (!queryClient || !authorUserId || !eventKey) return;

  const ownerAsCurrentUser = queryClient.getQueryData<ProfileLike>(["profile", authorUserId]);
  if (ownerAsCurrentUser?.user_id === authorUserId) return;

  if (hasOptimisticallyCounted(`${authorUserId}:${eventKey}`)) return;

  const applyBump = (queryKey: QueryKey) => {
    queryClient?.setQueryData(queryKey, (previous: unknown) => bumpProfile(previous, authorUserId));
  };

  applyBump(["profile", authorUserId]);

  queryClient.getQueryCache().findAll({ queryKey: ["user-profile"] }).forEach((query) => {
    applyBump(query.queryKey);
  });
}