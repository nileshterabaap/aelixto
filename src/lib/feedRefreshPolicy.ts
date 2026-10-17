// The feed is a session snapshot: pagination appends; only explicit refreshes
// or a real foreground transition may replace already-rendered posts.
export const followingFeedQueryPolicy = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

export function shouldRecoverQuery(key: unknown, needsRecovery: boolean, appEntry: boolean): boolean {
  return key === 'following-feed' ? appEntry : needsRecovery;
}

export function canStartFeedPull(atTop: boolean, visible: boolean, ignored: boolean, touchCount: number): boolean {
  return atTop && visible && !ignored && touchCount === 1;
}

export function feedPullDistance(dx: number, dy: number, atTop: boolean): number {
  if (!atTop || dy <= 0 || Math.abs(dx) >= dy) return 0;
  return Math.min(100, dy * 0.5 * (1 - dy / (dy + 300)));
}