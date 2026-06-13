import { useEffect, useRef } from 'react';
import { trackOriginalVisit } from '@/hooks/useViewTracking';

/**
 * Detects when the user clicks/taps into an embedded iframe (cross-origin embeds
 * steal focus from the parent window). Fires `original_visit` once per post.
 *
 * This is the standard "iframe click detector" pattern: when an iframe is
 * clicked, the parent window's active element becomes the iframe and a `blur`
 * event fires on the window. We treat that as the user engaging with the
 * original platform (tap-through to view/play/visit the source).
 */
export function useOriginalVisitTracker(
  containerRef: React.RefObject<HTMLElement>,
  postId: string,
  enabled: boolean = true,
) {
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [postId]);

  useEffect(() => {
    if (!enabled || !postId) return;
    const el = containerRef.current;
    if (!el) return;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      trackOriginalVisit(postId).catch(() => {
        // Allow a retry on next interaction
        firedRef.current = false;
      });
    };

    const onWindowBlur = () => {
      // The iframe steals focus when tapped — check that the now-active element
      // belongs to this post's embed container.
      setTimeout(() => {
        const active = document.activeElement;
        if (
          active &&
          active.tagName === 'IFRAME' &&
          el.contains(active)
        ) {
          fire();
        }
      }, 0);
    };

    // Fallback: explicit anchor/button clicks inside the embed (article CTAs,
    // fallback link cards) — anything that opens the original.
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
        fire();
      }
    };

    // Mobile iframes frequently absorb the tap without triggering window blur,
    // and YouTube/Reddit/Spotify treat the first pointerdown as a "play/visit"
    // intent. Treat any pointerdown inside an iframe-bearing embed as the
    // original-visit signal so engagement scoring stays accurate.
    const onPointerDown = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Only count taps that land on (or inside) an iframe — i.e. the actual
      // embedded player surface, not the action bar / caption area.
      const path = (e as PointerEvent).composedPath?.() || [];
      const tappedIframe =
        target.tagName === 'IFRAME' ||
        path.some((n) => (n as HTMLElement)?.tagName === 'IFRAME') ||
        !!el.querySelector('iframe');
      if (!tappedIframe) return;
      fire();
    };

    window.addEventListener('blur', onWindowBlur);
    el.addEventListener('click', onClick, true);
    el.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      window.removeEventListener('blur', onWindowBlur);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [containerRef, postId, enabled]);
}
