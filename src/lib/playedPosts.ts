import { useEffect, useState } from 'react';

/**
 * Session-scoped registry of posts the user actually pressed play on.
 *
 * Only these posts need the hard-suspend + pre-warm lifecycle: a post that was
 * never played has no audio to stop, so reloading its iframe off-screen is pure
 * wasted network/CPU.
 */
const playedPostIds = new Set<string>();
const listeners = new Set<(postId: string) => void>();
const pendingConfirmations = new Map<string, ReturnType<typeof setTimeout>>();

const PLAY_CONFIRM_DELAY_MS = 180;
const SCROLL_CANCEL_DISTANCE_PX = 12;

function getScrollTop(): number {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function confirmPostPlayed(postId: string) {
  if (!postId || playedPostIds.has(postId)) return;
  playedPostIds.add(postId);
  listeners.forEach((fn) => {
    try {
      fn(postId);
    } catch {
      /* noop */
    }
  });
}

export function hasPostBeenPlayed(postId: string): boolean {
  return playedPostIds.has(postId);
}

export function markPostPlayed(postId: string) {
  if (!postId || playedPostIds.has(postId) || pendingConfirmations.has(postId)) return;

  // Cross-origin embeds can report a play intent from the same touchstart that
  // begins a feed scroll. Defer arming hard-suspend briefly; if the page moved,
  // it was a scroll-over, not an actual play tap, so the untouched video must
  // not enter the suspend/reload lifecycle.
  if (typeof window === 'undefined') {
    confirmPostPlayed(postId);
    return;
  }

  const startY = getScrollTop();
  const timer = setTimeout(() => {
    pendingConfirmations.delete(postId);
    const moved = Math.abs(getScrollTop() - startY);
    if (moved > SCROLL_CANCEL_DISTANCE_PX) return;
    confirmPostPlayed(postId);
  }, PLAY_CONFIRM_DELAY_MS);

  pendingConfirmations.set(postId, timer);
}

/** Reactive read: re-renders once the given post gets played. */
export function useHasPostBeenPlayed(postId: string): boolean {
  const [played, setPlayed] = useState(() => hasPostBeenPlayed(postId));

  useEffect(() => {
    setPlayed(hasPostBeenPlayed(postId));
    if (hasPostBeenPlayed(postId)) return;

    const onPlayed = (id: string) => {
      if (id === postId) setPlayed(true);
    };
    listeners.add(onPlayed);
    return () => {
      listeners.delete(onPlayed);
    };
  }, [postId]);

  return played;
}
