import { useEffect, useRef } from 'react';
import { trackOriginalVisit, trackView } from '@/hooks/useViewTracking';

/**
 * Supplementary engagement detector for cross-origin embeds.
 *
 * The primary tracker (useOriginalVisitTracker) is frozen by the platform guard
 * and only awards `original_visit` when a tap lands on a parent-side outbound
 * anchor. Cross-origin iframes (X, Threads, YouTube, TikTok, Spotify, Pinterest,
 * LinkedIn…) never expose such an anchor, so those platforms stopped scoring.
 *
 * This hook restores the July-31 behaviour without touching guarded files:
 *  - focus moves into one of our embed iframes  → the user interacted with the
 *    embedded player → `video_play` for playable posts.
 *  - the document goes hidden / the window unloads shortly after that focus
 *    → the user was handed off to the original platform → `original_visit`.
 *
 * The backend deduplicates per post + event type, so overlapping signals from
 * the frozen tracker are harmless.
 */
export function useEmbedEngagementFallback(
  containerRef: React.RefObject<HTMLElement>,
  postId: string,
  enabled: boolean = true,
  isPlayable: boolean = false,
) {
  const playFiredRef = useRef(false);
  const visitFiredRef = useRef(false);
  const lastIframeFocusRef = useRef(0);

  useEffect(() => {
    playFiredRef.current = false;
    visitFiredRef.current = false;
    lastIframeFocusRef.current = 0;
  }, [postId]);

  useEffect(() => {
    if (!enabled || !postId) return;
    const el = containerRef.current;
    if (!el) return;

    const ownsIframe = (node: Element | null): boolean => {
      if (!node || node.tagName !== 'IFRAME') return false;
      return el.contains(node);
    };

    const firePlay = () => {
      if (!isPlayable || playFiredRef.current) return;
      playFiredRef.current = true;
      void trackView({ postId, eventType: 'video_play' }).catch(() => {
        playFiredRef.current = false;
      });
    };

    const fireVisit = () => {
      if (visitFiredRef.current) return;
      visitFiredRef.current = true;
      void trackOriginalVisit(postId).catch(() => {
        visitFiredRef.current = false;
      });
    };

    const handleBlur = () => {
      // Deferred: activeElement updates after the blur tick in some engines.
      window.setTimeout(() => {
        if (!ownsIframe(document.activeElement as Element | null)) return;
        lastIframeFocusRef.current = Date.now();
        firePlay();
      }, 0);
    };

    // Some embeds (Instagram/Facebook plugin frames) hand the user off to the
    // native app without ever giving the iframe DOM focus, so a plain tap
    // inside the embed also counts as a handoff candidate.
    const handlePointerDown = () => {
      lastIframeFocusRef.current = Date.now();
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      const focusedOurIframe =
        ownsIframe(document.activeElement as Element | null) ||
        Date.now() - lastIframeFocusRef.current < 10000;
      if (!focusedOurIframe) return;
      fireVisit();
    };

    const handlePageHide = () => {
      if (Date.now() - lastIframeFocusRef.current > 10000) return;
      fireVisit();
    };

    el.addEventListener('pointerdown', handlePointerDown, true);
    el.addEventListener('touchstart', handlePointerDown, { capture: true, passive: true });
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown, true);
      el.removeEventListener('touchstart', handlePointerDown, true);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [containerRef, postId, enabled, isPlayable]);
}
