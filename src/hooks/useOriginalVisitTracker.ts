import { useEffect, useRef } from 'react';
import { trackOriginalVisit, trackView } from '@/hooks/useViewTracking';

// no-op stub kept to minimize diff after removing temporary diagnostic logger
const traceLog = (..._args: unknown[]) => {};

let threadsTraceSeq = 0;
const THREADS_TRACE_PREFIX = '[THREADS_VIDEO_PLAY_TRACE]';

const describeTraceTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return { tag: null, className: null, id: null };
  return {
    tag: target.tagName,
    className: String(target.className || ''),
    id: target.id || null,
  };
};

const threadsTrace = (
  postId: string,
  functionName: string,
  args: Record<string, unknown>,
  returnValue: unknown,
  continued: boolean,
  nextFunction?: string,
) => {
  // Temporary production trace for the Threads video_play regression. This is
  // intentionally console-only and does not alter behavior.
  console.info(THREADS_TRACE_PREFIX, {
    seq: ++threadsTraceSeq,
    ts: Date.now(),
    postId,
    functionName,
    args,
    returnValue,
    continued,
    nextFunction: nextFunction || null,
  });
};

const threadsVideoPlayFiredPosts = new Set<string>();
const lastThreadsCaptureRef: { postId: string | null; time: number } = {
  postId: null,
  time: 0,
};

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
      threadsTrace(
        postId,
        'firePlay',
        { trackPlayableInteraction, alreadyFired: playFiredRef.current },
        trackPlayableInteraction && !playFiredRef.current ? 'will-dispatch-video_play' : 'skipped',
        trackPlayableInteraction && !playFiredRef.current,
        trackPlayableInteraction && !playFiredRef.current ? 'trackView' : undefined,
      );
      if (trackPlayableInteraction && !playFiredRef.current) {
        playFiredRef.current = true;
        traceLog('firePlay', 'dispatch:trackView(video_play)', { postId });
        trackView({ postId, eventType: 'video_play' }).then((ok) => {
          traceLog('firePlay', 'trackView:result', { postId, detail: { ok } });
          threadsTrace(
            postId,
            'firePlay.trackView.then',
            { eventType: 'video_play' },
            { ok },
            false,
          );
        }).catch((err) => {
          traceLog('firePlay', 'trackView:error', { postId, error: err });
          threadsTrace(
            postId,
            'firePlay.trackView.catch',
            { eventType: 'video_play' },
            { error: err instanceof Error ? err.message : String(err) },
            false,
          );
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
      const result = node instanceof Element && (node.tagName === 'IFRAME' || !!node.closest('iframe'));
      threadsTrace(postId, 'isInsideIframe', { target: describeTraceTarget(node) }, result, true, 'onPointerDown.branch');
      return result;
    };

    const THREADS_EMBED_SELECTOR =
      '.js-threads-embed, [data-threads-embed], blockquote.text-post-media';
    const isInsideThreadsEmbed = (node: EventTarget | null): boolean => {
      const result = node instanceof Element && !!node.closest(THREADS_EMBED_SELECTOR);
      threadsTrace(postId, 'isInsideThreadsEmbed', { target: describeTraceTarget(node) }, result, true, 'onPointerDown.branch');
      return result;
    };

    const isXPost = (): boolean => {
      const scope = el.querySelector(
        'blockquote.twitter-tweet, [data-tweet-id], iframe[src*="twitter.com"], iframe[src*="x.com"], iframe[src*="platform.twitter.com"]',
      );
      return !!scope;
    };

    const getThreadsIframe = (): HTMLIFrameElement | null => {
      const iframe = el.querySelector(
        'iframe[src*="threads.net"], iframe[src*="threads.com"]',
      ) as HTMLIFrameElement | null;
      threadsTrace(
        postId,
        'getThreadsIframe',
        {},
        iframe ? { found: true, src: iframe.getAttribute('src'), sandbox: iframe.getAttribute('sandbox') } : { found: false },
        true,
        'isThreadsPost',
      );
      return iframe;
    };
    const isThreadsPost = (): boolean => {
      const result = !!getThreadsIframe();
      threadsTrace(postId, 'isThreadsPost', {}, result, true, 'caller-branch');
      return result;
    };

    const fireThreadsPlayOnce = () => {
      const alreadyFiredForPost = threadsVideoPlayFiredPosts.has(postId);
      threadsTrace(
        postId,
        'fireThreadsPlayOnce',
        { alreadyFiredForPost },
        alreadyFiredForPost ? 'skipped-existing-post-set' : 'will-call-firePlay',
        !alreadyFiredForPost,
        alreadyFiredForPost ? undefined : 'firePlay',
      );
      if (alreadyFiredForPost) return;
      lastThreadsCaptureRef.postId = postId;
      lastThreadsCaptureRef.time = Date.now();
      threadsVideoPlayFiredPosts.add(postId);
      firePlay();
      lastIframeInteractionRef.current = Date.now();
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
      const insideIframe = isInsideIframe(e.target);
      const insideThreadsEmbed = isInsideThreadsEmbed(e.target);
      const threadsPost = isThreadsPost();
      threadsTrace(
        postId,
        'onPointerDown',
        {
          type: e.type,
          target: describeTraceTarget(e.target),
          trackPlayableInteraction,
          insideIframe,
          insideThreadsEmbed,
          threadsPost,
          path,
        },
        'branch-evaluated',
        insideIframe || (trackPlayableInteraction && insideThreadsEmbed) || (trackPlayableInteraction && threadsPost),
        insideIframe
          ? 'insideIframe-branch'
          : trackPlayableInteraction && insideThreadsEmbed
            ? 'fireThreadsPlayOnce'
            : trackPlayableInteraction && threadsPost
              ? 'fireThreadsPlayOnce'
              : undefined,
      );
      if (insideIframe) {
        if (trackPlayableInteraction) {
          // Playable posts: tapping into the iframe = Play (+1) only.
          // "Visited the original source" is intentionally NOT inferred here;
          // it must come from an explicit anchor click or the platform-icon button.
          if (threadsPost) {
            fireThreadsPlayOnce();
          } else {
            firePlay();
            lastIframeInteractionRef.current = now;
          }
        } else {
          fireOriginal();
        }
      } else if (trackPlayableInteraction && insideThreadsEmbed) {
        // Threads SDK inflates a same-origin <blockquote> (no iframe), so the
        // isInsideIframe check above never matches. Treat a pointerdown on the
        // inflated Threads embed as a play interaction (+1 only).
        fireThreadsPlayOnce();
      } else if (trackPlayableInteraction && threadsPost) {
        // Threads is rendered as a direct cross-origin iframe. On mobile the
        // event target for a tap on the iframe surface is often reported as
        // an ancestor element (not IFRAME), *and* body.at-scroll-top applies
        // pointer-events:none to iframes so the tap can land on a plain div
        // ancestor entirely. A hit-test against the iframe rect is fragile
        // in both cases. Since this container only hosts one Threads post,
        // any pointerdown that reaches this handler is an intent to play.
        fireThreadsPlayOnce();
      }
    };

    const onWindowBlur = () => {
      traceLog('onWindowBlur', 'fired', { postId });
      // The iframe steals focus when tapped — check that the now-active element
      // belongs to this post's embed container.
      // Threads-only reliable path: cross-origin iframe taps on mobile Chrome
      // frequently don't produce a parent-side pointerdown, and
      // document.activeElement after the blur is often <body> rather than the
      // iframe. Instead, detect that focus left the window *while the page is
      // still visible* — that only happens when focus moved into a child
      // iframe. If this post has a Threads iframe and it's on-screen, credit
      // one video_play. This runs a short delay so we can confirm the page did
      // not go hidden (that would be an app backgrounding, handled elsewhere).
      const threadsPost = isThreadsPost();
      threadsTrace(
        postId,
        'onWindowBlur',
        { trackPlayableInteraction, threadsPost, alreadyFired: playFiredRef.current },
        trackPlayableInteraction && threadsPost && !playFiredRef.current ? 'will-check-iframe' : 'skipped-threads-blur-path',
        trackPlayableInteraction && threadsPost && !playFiredRef.current,
        trackPlayableInteraction && threadsPost && !playFiredRef.current ? 'getThreadsIframe' : undefined,
      );
      if (trackPlayableInteraction && threadsPost && !playFiredRef.current) {
        const iframe = getThreadsIframe();
        if (iframe) {
          setTimeout(() => {
            if (playFiredRef.current) {
              threadsTrace(postId, 'onWindowBlur.timeout', { alreadyFired: true }, 'skipped-already-fired', false);
              return;
            }
            // Each mounted Threads post owns a window.blur listener. A single
            // iframe tap blurs the window globally, so only the post whose
            // capture layer saw the tap may use this fallback; otherwise every
            // visible Threads post would record video_play from one tap.
            if (
              lastThreadsCaptureRef.postId !== postId ||
              Date.now() - lastThreadsCaptureRef.time > 1200
            ) {
              threadsTrace(
                postId,
                'onWindowBlur.timeout',
                { lastCapturePostId: lastThreadsCaptureRef.postId, msSinceCapture: Date.now() - lastThreadsCaptureRef.time },
                'skipped-capture-mismatch',
                false,
              );
              return;
            }
            if (document.visibilityState === 'hidden') {
              threadsTrace(postId, 'onWindowBlur.timeout', { visibilityState: document.visibilityState }, 'skipped-hidden', false);
              return;
            }
            const r = iframe.getBoundingClientRect();
            const onScreen =
              r.width > 0 &&
              r.height > 0 &&
              r.bottom > 0 &&
              r.top < (window.innerHeight || document.documentElement.clientHeight);
            if (!onScreen) {
              threadsTrace(
                postId,
                'onWindowBlur.timeout',
                { rect: { width: r.width, height: r.height, top: r.top, bottom: r.bottom } },
                'skipped-offscreen',
                false,
              );
              return;
            }
            threadsTrace(
              postId,
              'onWindowBlur.timeout',
              { rect: { width: r.width, height: r.height, top: r.top, bottom: r.bottom } },
              'will-call-firePlay',
              true,
              'firePlay',
            );
            firePlay();
            lastIframeInteractionRef.current = Date.now();
          }, 120);
          return;
        }
      }
      // Non-Threads path: original activeElement === IFRAME check.
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
      // Playable posts (X/YouTube/TikTok/IG/FB/LinkedIn/Pinterest/Spotify/
      // Threads): iframe tap credits Play only. "Visit" must come from an
      // explicit anchor click or the header platform-icon button, so we
      // never infer visit from an app-background here on playable posts.
      if (trackPlayableInteraction) return;
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
        // For X and Threads, anchor clicks inside the embed body must NOT
        // record `original_visit` — body taps are view/play-only, and the
        // sole sanctioned Visit trigger is the header platform icon.
        if (trackPlayableInteraction && (isXPost() || isThreadsPost())) {
          return;
        }
        fireOriginal();
      }
    };

    const handleIframeFocus = () => {
      const now = Date.now();
      const threadsPost = isThreadsPost();
      threadsTrace(
        postId,
        'handleIframeFocus',
        { trackPlayableInteraction, threadsPost },
        trackPlayableInteraction ? (threadsPost ? 'will-call-fireThreadsPlayOnce' : 'will-call-firePlay') : 'will-call-fireOriginal',
        true,
        trackPlayableInteraction ? (threadsPost ? 'fireThreadsPlayOnce' : 'firePlay') : 'fireOriginal',
      );
      if (trackPlayableInteraction) {
        if (threadsPost) {
          fireThreadsPlayOnce();
        } else {
          firePlay();
          lastIframeInteractionRef.current = now;
        }
      } else {
        fireOriginal();
      }
    };

    // Cleanup list retained for API compatibility with the effect teardown.
    // The Threads play signal now rides on the container-level `touchstart`
    // capture listener wired below (see `el.addEventListener('touchstart',
    // onPointerDown, { capture: true, passive: true })`). On mobile Chrome
    // and iOS Safari a touch that lands on a cross-origin iframe still
    // dispatches `touchstart` on the parent in the capture phase, so
    // `fireThreadsPlayOnce()` runs on the very first tap without inserting
    // any visual/interactive overlay above the Threads player. This removes
    // the duplicate "custom" Play affordance while preserving video_play.
    const threadsCaptureCleanups: Array<() => void> = [];

    const attachIframeListeners = (iframe: HTMLIFrameElement) => {
      const src = iframe.getAttribute('src') || '';
      if (src.includes('threads.net') || src.includes('threads.com')) {
        threadsTrace(
          postId,
          'attachIframeListeners',
          { src, sandboxBefore: iframe.getAttribute('sandbox') },
          'will-attach-focus-load-and-nav-lock',
          true,
          'applyNavLockSandbox',
        );
      }
      iframe.addEventListener('focus', handleIframeFocus);
      iframe.addEventListener('load', () => {
        try {
          iframe.contentWindow?.addEventListener?.('focus', handleIframeFocus);
        } catch {
          // Cross-origin iframes may reject direct listener attachment.
        }
      }, { once: true });
      applyNavLockSandbox(iframe);
    };

    // For X and Threads embeds we cannot inspect the cross-origin iframe to
    // distinguish "video pixel" from "username link pixel". To honor the
    // product rule ("embedded post must never navigate to the original"),
    // we sandbox the iframe: allow scripts + same-origin (so the player,
    // postMessage height sync, and video playback keep working), but omit
    // allow-popups and allow-top-navigation*. Any link tap inside the embed
    // is silently dropped by the browser instead of opening a new tab or
    // navigating the app away. Play/pause on the native player is unaffected.
    const applyNavLockSandbox = (iframe: HTMLIFrameElement) => {
      if (!trackPlayableInteraction) return;
      if (iframe.dataset.navLockApplied === '1') return;
      const src = (iframe.getAttribute('src') || '').toLowerCase();
      const title = (iframe.getAttribute('title') || '').toLowerCase();
      const id = (iframe.id || '').toLowerCase();
      const isX =
        src.includes('twitter.com') ||
        src.includes('x.com') ||
        src.includes('platform.twitter.com') ||
        id.includes('twitter-widget') ||
        title.includes('twitter') ||
        title.includes('tweet');
      const isThreads =
        src.includes('threads.net') || src.includes('threads.com');
      if (!isX && !isThreads) {
        return;
      }
      if (isThreads) {
        threadsTrace(
          postId,
          'applyNavLockSandbox',
          { src, alreadyApplied: iframe.dataset.navLockApplied === '1' },
          'will-set-sandbox',
          false,
        );
      }
      iframe.dataset.navLockApplied = '1';
      // Setting sandbox on an already-loaded iframe reloads it once; that's
      // acceptable and only happens the first time we see the frame.
      iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-presentation',
      );
    };

    el.querySelectorAll('iframe').forEach(attachIframeListeners);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node instanceof HTMLIFrameElement &&
            ((node.getAttribute('src') || '').includes('threads.net') || (node.getAttribute('src') || '').includes('threads.com'))
          ) {
            threadsTrace(postId, 'MutationObserver', { node: 'threads-iframe' }, 'will-call-attachIframeListeners', true, 'attachIframeListeners');
          }
          if (node instanceof HTMLElement) {
            const threadsIframes = Array.from(node.querySelectorAll('iframe[src*="threads.net"], iframe[src*="threads.com"]'));
            if (threadsIframes.length > 0) {
              threadsTrace(postId, 'MutationObserver', { nestedThreadsIframes: threadsIframes.length }, 'will-call-attachIframeListeners', true, 'attachIframeListeners');
            }
          }
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
      threadsCaptureCleanups.forEach((cleanup) => cleanup());
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
