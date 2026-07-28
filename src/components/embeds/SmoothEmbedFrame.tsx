import { useEffect, useState } from "react";

/**
 * Shared "Pinterest-style" smooth reveal primitives.
 *
 * Pinterest embeds feel smoother than every other platform because they:
 *  1. reserve a fixed height before the iframe mounts,
 *  2. stack a pulse skeleton *under* the iframe (same box, no reflow),
 *  3. fade the iframe in over 300ms driven by its own `load` event.
 *
 * These helpers make (2) and (3) reusable without touching any platform's
 * data/measurement/tracking logic. Purely presentational.
 */

export const EMBED_FADE_MS = 300;

/** Force-reveal fallback so a missed readiness signal can never leave content invisible. */
const REVEAL_SAFETY_MS = 2500;

/**
 * Returns true once the embed is ready, or after a safety timeout.
 */
export function useSmoothReveal(ready: boolean): boolean {
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setForced(true), REVEAL_SAFETY_MS);
    return () => window.clearTimeout(t);
  }, [ready]);

  return ready || forced;
}

/** Style to spread onto the embed element itself for the fade. */
export function smoothFadeStyle(revealed: boolean): React.CSSProperties {
  return {
    opacity: revealed ? 1 : 0,
    transition: `opacity ${EMBED_FADE_MS}ms ease`,
  };
}

/**
 * Pulse skeleton stacked beneath the embed inside the same fixed-height,
 * position:relative wrapper. Never intercepts pointer events, and stays at
 * the bottom of the stacking order so platform overlays keep working.
 */
export function EmbedFadeSkeleton({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden
      className="absolute inset-0 animate-pulse rounded-lg bg-muted"
      style={{ zIndex: 0, pointerEvents: "none" }}
    />
  );
}
