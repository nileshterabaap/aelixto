import { useEffect, useRef } from 'react';
import { trackOriginalVisit, trackView } from '@/hooks/useViewTracking';

/**
 * Detects when the user taps/clicks into an embedded iframe or an outbound
 * anchor inside the embed, and fires `original_visit` once per post.
 *
 * Strategy (covers mobile + desktop reliably):
 *  1. `pointerdown` (capture) on the container — if the event target is an
 *     IFRAME (or sits inside one of our embed iframes), we treat that as a
 *     tap-through to the original platform (play video, open Spotify, etc.).
 *  2. Anchor click anywhere in the embed (article CTAs, fallback link cards).
 *  3. `window.blur` + active-element === IFRAME fallback (desktop click).
 *  4. `document.visibilitychange` → hidden shortly after a pointerdown on the
 *     embed (catches deep-links that hand the user to a native app).
 */
export function useOriginalVisitTracker(
  containerRef: React.RefObject<HTMLElement>,
  postId: string,
  enabled: boolean = true,
  trackPlayableInteraction: boolean = false,
) {
  const firedRef = useRef(false);
  const playFiredRef = useRef(false);
  const recentPointerRef = useRef(0);
  const lastIframeInteractionRef = useRef(0);
  const originalDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    firedRef.current = false;
    playFiredRef.current = false;
    recentPointerRef.current = 0;
    lastIframeInteractionRef.current = 0;
    if (originalDwellTimerRef.current) {
      clearTimeout(originalDwellTimerRef.current);
      originalDwellTimerRef.current = null;
    }
  }, [postId]);

  useEffect(() => {
    if (!enabled || !postId) return;
    const el = containerRef.current;
    if (!el) return;

    const firePlay = () => {
      if (trackPlayableInteraction && !playFiredRef.current) {
        playFiredRef.current = true;
        trackView({ postId, eventType: 'video_play' }).catch(() => {
          playFiredRef.current = false;
        });
      }
    };

    const fireOriginal = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      trackOriginalVisit(postId).catch(() => {
        // Allow a retry on next interaction
        firedRef.current = false;
      });
    };

    const scheduleOriginalFromPlayableDwell = () => {
      if (!trackPlayableInteraction || firedRef.current || originalDwellTimerRef.current) return;
      originalDwellTimerRef.current = setTimeout(() => {
        originalDwellTimerRef.current = null;
        // Cross-origin Instagram/TikTok/etc. controls do not reliably bubble
        // their "open original" tap to the parent page. If a playable embed has
        // focus long enough to be watched, record the original-platform
        // engagement so reels don't get stuck at impression/play only.
        if (playFiredRef.current && document.visibilityState === 'visible') {
          fireOriginal();
        }
      }, 3500);
    };

    const isInsideIframe = (node: EventTarget | null): boolean => {
      if (!(node instanceof Element)) return false;
      if (node.tagName === 'IFRAME') return true;
      return !!node.closest('iframe');
    };

    const onPointerDown = (e: Event) => {
      const now = Date.now();
      recentPointerRef.current = now;
      if (isInsideIframe(e.target)) {
        if (trackPlayableInteraction) {
          firePlay();
          scheduleOriginalFromPlayableDwell();
          if (playFiredRef.current && lastIframeInteractionRef.current > 0 && now - lastIframeInteractionRef.current > 1200) {
            fireOriginal();
          }
          lastIframeInteractionRef.current = now;
        } else {
          fireOriginal();
        }
      }
    };

    const onWindowBlur = () => {
      // The iframe steals focus when tapped — check that the now-active element
      // belongs to this post's embed container.
      setTimeout(() => {
        const now = Date.now();
        const active = document.activeElement;
        if (
          active &&
          active.tagName === 'IFRAME' &&
          el.contains(active)
        ) {
          if (trackPlayableInteraction) {
            if (playFiredRef.current && lastIframeInteractionRef.current > 0 && now - lastIframeInteractionRef.current > 1200) {
              fireOriginal();
            } else {
              firePlay();
              scheduleOriginalFromPlayableDwell();
            }
            lastIframeInteractionRef.current = now;
          } else {
            fireOriginal();
          }
        }
      }, 0);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      // If the page hid within ~3s of a pointerdown on this embed, the user
      // likely tapped through to a native app / new tab.
      const now = Date.now();
      if (
        now - recentPointerRef.current < 3000 ||
        now - lastIframeInteractionRef.current < 10000 ||
        (trackPlayableInteraction && playFiredRef.current)
      ) {
        fireOriginal();
      }
    };

    // Fallback: explicit anchor/button clicks inside the embed (article CTAs,
    // fallback link cards) — anything that opens the original.
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
        fireOriginal();
      }
    };

    const handleIframeFocus = () => {
      const now = Date.now();
      if (trackPlayableInteraction) {
        if (playFiredRef.current && lastIframeInteractionRef.current > 0 && now - lastIframeInteractionRef.current > 1200) {
          fireOriginal();
        } else {
          firePlay();
          scheduleOriginalFromPlayableDwell();
        }
        lastIframeInteractionRef.current = now;
      } else {
        fireOriginal();
      }
    };

    const attachIframeListeners = (iframe: HTMLIFrameElement) => {
      iframe.addEventListener('focus', handleIframeFocus);
      iframe.addEventListener('load', () => {
        try {
          iframe.contentWindow?.addEventListener?.('focus', handleIframeFocus);
        } catch {
          // Cross-origin iframes may reject direct listener attachment.
        }
      }, { once: true });
    };

    el.querySelectorAll('iframe').forEach(attachIframeListeners);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLIFrameElement) attachIframeListeners(node);
          if (node instanceof HTMLElement) node.querySelectorAll('iframe').forEach(attachIframeListeners);
        });
      });
    });
    observer.observe(el, { childList: true, subtree: true });

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('touchstart', onPointerDown, { capture: true, passive: true });
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    el.addEventListener('click', onClick, true);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('touchstart', onPointerDown, true);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      el.removeEventListener('click', onClick, true);
      observer.disconnect();
      if (originalDwellTimerRef.current) {
        clearTimeout(originalDwellTimerRef.current);
        originalDwellTimerRef.current = null;
      }
    };
  }, [containerRef, postId, enabled, trackPlayableInteraction]);
}

export function markOriginalVisit(postId: string) {
  if (!postId) return;
  trackOriginalVisit(postId).catch(() => {});
}
