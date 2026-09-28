import { useEffect, useState } from 'react';

/**
 * Session-scoped registry of posts the user actually pressed play on.
 *
 * Only these posts need the hard-suspend + pre-warm lifecycle: a post that was
 * never played has no audio to stop, so reloading its iframe off-screen is pure
 * wasted network/CPU.
 */
const playedPostIds = new Set<string>();
type PlayedListener = (postId: string, generation: number) => void;
const listeners = new Set<PlayedListener>();
const pendingConfirmations = new Map<string, ReturnType<typeof setTimeout>>();
const playbackGenerations = new Map<string, number>();

const PLAY_CONFIRM_DELAY_MS = 180;
let movementVersion = 0;
let movementTrackingReady = false;

function ensureMovementTracking() {
  if (movementTrackingReady || typeof document === 'undefined') return;
  movementTrackingReady = true;
  const markMovement = () => { movementVersion += 1; };
  // Capture scrolls from every scroll container, including the profile viewer.
  document.addEventListener('scroll', markMovement, { capture: true, passive: true });
  document.addEventListener('touchmove', markMovement, { capture: true, passive: true });
  document.addEventListener('pointermove', (event) => {
    if (event.buttons !== 0) markMovement();
  }, { capture: true, passive: true });
}

function confirmPostPlayed(postId: string) {
  if (!postId) return;
  playedPostIds.add(postId);
  const generation = (playbackGenerations.get(postId) || 0) + 1;
  playbackGenerations.set(postId, generation);
  listeners.forEach((fn) => {
    try {
      fn(postId, generation);
    } catch {
      /* noop */
    }
  });
}

/** Subscribe to confirmed plays without coupling media control to React renders. */
export function subscribePostPlayed(listener: PlayedListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function hasPostBeenPlayed(postId: string): boolean {
  return playedPostIds.has(postId);
}

export function getPostPlaybackGeneration(postId: string): number {
  return playbackGenerations.get(postId) || 0;
}

export function markPostPlayed(postId: string) {
  if (!postId || pendingConfirmations.has(postId)) return;

  // Cross-origin embeds can report a play intent from the same touchstart that
  // begins a feed scroll. Defer arming hard-suspend briefly; if the page moved,
  // it was a scroll-over, not an actual play tap, so the untouched video must
  // not enter the suspend/reload lifecycle.
  if (typeof window === 'undefined') {
    confirmPostPlayed(postId);
    return;
  }

  ensureMovementTracking();
  const startMovementVersion = movementVersion;
  const timer = setTimeout(() => {
    pendingConfirmations.delete(postId);
    if (movementVersion !== startMovementVersion) return;
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

/** Reactive playback epoch; increments after each genuine, non-scroll play tap. */
export function usePostPlaybackGeneration(postId: string): number {
  const [generation, setGeneration] = useState(() => getPostPlaybackGeneration(postId));

  useEffect(() => {
    ensureMovementTracking();
    setGeneration(getPostPlaybackGeneration(postId));
    const onPlayed = (id: string) => {
      if (id === postId) setGeneration(getPostPlaybackGeneration(postId));
    };
    listeners.add(onPlayed);
    return () => { listeners.delete(onPlayed); };
  }, [postId]);

  return generation;
}
