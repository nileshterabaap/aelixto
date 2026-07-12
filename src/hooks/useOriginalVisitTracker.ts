import { useEffect, useRef } from 'react';
import { trackOriginalVisit, trackView } from '@/hooks/useViewTracking';

// no-op stub kept to minimize diff after removing temporary diagnostic logger
const traceLog = (..._args: unknown[]) => {};

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
      traceLog('firePlay', 'called', { postId, detail: { alreadyFired: playFiredRef.current, trackPlayableInteraction } });
      if (trackPlayableInteraction && !playFiredRef.current) {
        playFiredRef.current = true;
        traceLog('firePlay', 'dispatch:trackView(video_play)', { postId });
        trackView({ postId, eventType: 'video_play' }).then((ok) => {
          traceLog('firePlay', 'trackView:result', { postId, detail: { ok } });
        }).catch((err) => {
          traceLog('firePlay', 'trackView:error', { postId, error: err });
          playFiredRef.current = false;
        });
      }
    };

    const fireOriginal = () => {
      traceLog('fireOriginal', 'called', { postId, detail: { alreadyFired: firedRef.current } });
      if (firedRef.current) return;
      firedRef.current = true;
      traceLog('fireOriginal', 'dispatch:trackOriginalVisit', { postId });
      trackOriginalVisit(postId).then((ok) => {
        traceLog('fireOriginal', 'trackOriginalVisit:result', { postId, detail: { ok } });
      }).catch((err) => {
        traceLog('fireOriginal', 'trackOriginalVisit:error', { postId, error: err });
        // Allow a retry on next interaction
        firedRef.current = false;
      });
    };

    const scheduleOriginalFromPlayableDwell = () => {
      // Intentionally a no-op: "Visited the original source" must only fire
      // when the user actually leaves the app for the source platform (anchor
      // click, tab hidden, blur to iframe on non-playable). Watching a video
      // inline should count as Play (+1) only, not Play + Visit.
      return;
    };

    const isInsideIframe = (node: EventTarget | null): boolean => {
      if (!(node instanceof Element)) return false;
      if (node.tagName === 'IFRAME') return true;
      return !!node.closest('iframe');
    };

    const THREADS_EMBED_SELECTOR =
      '.js-threads-embed, [data-threads-embed], blockquote.text-post-media';
    const isInsideThreadsEmbed = (node: EventTarget | null): boolean => {
      if (!(node instanceof Element)) return false;
      return !!node.closest(THREADS_EMBED_SELECTOR);
    };

    const isXPost = (): boolean => {
      const scope = el.querySelector(
        'blockquote.twitter-tweet, [data-tweet-id], iframe[src*="twitter.com"], iframe[src*="x.com"], iframe[src*="platform.twitter.com"]',
      );
      return !!scope;
    };

    const onPointerDown = (e: Event) => {
      const now = Date.now();
      recentPointerRef.current = now;
      const t = e.target as Element | null;
      const path: string[] = [];
      let cur: Element | null = t;
      for (let i = 0; cur && i < 6; i++) {
        path.push(`${cur.tagName}${cur.className ? '.' + String(cur.className).toString().split(' ').slice(0,2).join('.') : ''}`);
        cur = cur.parentElement;
      }
      traceLog('onPointerDown', e.type, {
        postId,
        detail: {
          trackPlayableInteraction,
          targetTag: t?.tagName,
          targetClass: String(t?.className || ''),
          insideIframe: isInsideIframe(e.target),
          insideThreadsEmbed: isInsideThreadsEmbed(e.target),
          isXPost: isXPost(),
          path,
        },
      });
      if (isInsideIframe(e.target)) {
        if (trackPlayableInteraction) {
          // Playable posts: tapping into the iframe = Play (+1) only.
          // "Visited the original source" is intentionally NOT inferred here;
          // it must come from an explicit anchor click or the platform-icon button.
          firePlay();
          lastIframeInteractionRef.current = now;
        } else {
          fireOriginal();
        }
      } else if (trackPlayableInteraction && isInsideThreadsEmbed(e.target)) {
        // Threads SDK inflates a same-origin <blockquote> (no iframe), so the
        // isInsideIframe check above never matches. Treat a pointerdown on the
        // inflated Threads embed as a play interaction (+1 only).
        firePlay();
        lastIframeInteractionRef.current = now;
      }
    };

    const onWindowBlur = () => {
      traceLog('onWindowBlur', 'fired', { postId });
      // The iframe steals focus when tapped — check that the now-active element
      // belongs to this post's embed container.
      setTimeout(() => {
        const now = Date.now();
        const active = document.activeElement;
        traceLog('onWindowBlur', 'setTimeout', {
          postId,
          detail: {
            activeTag: active?.tagName,
            activeInsideEl: active ? el.contains(active) : false,
            trackPlayableInteraction,
          },
        });
        if (
          active &&
          active.tagName === 'IFRAME' &&
          el.contains(active)
        ) {
          if (trackPlayableInteraction) {
            firePlay();
            lastIframeInteractionRef.current = now;
          } else {
            fireOriginal();
          }
        }
      }, 0);
    };

    const onVisibilityChange = () => {
      traceLog('onVisibilityChange', document.visibilityState, {
        postId,
        detail: {
          trackPlayableInteraction,
          isXPost: isXPost(),
          msSincePointer: Date.now() - recentPointerRef.current,
          msSinceIframe: Date.now() - lastIframeInteractionRef.current,
        },
      });
      if (document.visibilityState !== 'hidden') return;
      // Only infer a visit for non-playable embeds (article/link cards where
      // tapping opens the source). Playable posts must not auto-fire Visit on
      // app backgrounding — user may just be watching inline.
      // Exception: X/Twitter embeds are a cross-origin iframe that swallows
      // internal anchor clicks; when the user taps through to the original
      // post, the only observable signal is the app becoming hidden shortly
      // after a pointerdown on the embed. Scope the fallback to X only so
      // other playable platforms (YouTube/TikTok/IG/FB/LinkedIn/Pinterest/
      // Spotify/Threads) are unaffected.
      if (trackPlayableInteraction && !isXPost()) return;
      const now = Date.now();
      if (
        now - recentPointerRef.current < 3000 ||
        now - lastIframeInteractionRef.current < 10000
      ) {
        fireOriginal();
      }
    };

    // Fallback: explicit anchor/button clicks inside the embed (article CTAs,
    // fallback link cards) — anything that opens the original.
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const anchorProbe = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      traceLog('onClick', 'fired', {
        postId,
        detail: {
          targetTag: target?.tagName,
          anchorHref: anchorProbe?.href || null,
        },
      });
      if (!target) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor && anchor.href && !anchor.href.startsWith('javascript:')) {
        fireOriginal();
      }
    };

    const handleIframeFocus = () => {
      const now = Date.now();
      if (trackPlayableInteraction) {
        firePlay();
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
