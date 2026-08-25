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

export function hasPostBeenPlayed(postId: string): boolean {
  return playedPostIds.has(postId);
}

export function markPostPlayed(postId: string) {
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
