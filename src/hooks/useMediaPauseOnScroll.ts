import { useEffect, useRef, useState, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Two-stage media lifecycle for playable media only.
 *
 * Stage A (near viewport):
 *   - Pause native <video>/<audio> via .pause()
 *   - Pause YouTube via postMessage pauseVideo
 *   - Pause Spotify via postMessage { command: 'pause' }
 *   - Preserve non-API iframe visuals (do NOT hide or destroy them)
 *
 * Stage B (far from viewport):
 *   - Hard-suspend playable iframes by swapping src → about:blank
 *   - Restore them early when they come back near the viewport so they can load
 *     before reaching the active center post again
 *
 * Only applies to containers with playable media (video, audio, YouTube,
 * Spotify, TikTok, Instagram reels, etc.). Static embeds are ignored.
 */

// ── Selectors ──────────────────────────────────────────────────────────

const YOUTUBE_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_SELECTOR = 'iframe[src*="open.spotify.com"]';
const SUSPENDED_IFRAME_SELECTOR = 'iframe[data-aelix-suspended="1"]';
const HARD_SUSPEND_MIN_DISTANCE_PX = 2800;

// ── Data attributes for hard-suspend bookkeeping ───────────────────────

const SUSPENDED_FLAG = 'aelixSuspended';
const SUSPENDED_SRC = 'aelixSuspendedSrc';

// ── Detection: does this container currently contain playable media? ───

const PLAYABLE_MEDIA_SELECTOR = 'video, audio';
const PLAYABLE_IFRAME_HINTS = [
  'youtube.com',
  'youtube-nocookie.com',
  'open.spotify.com/embed',
  'tiktok.com/embed',
  'facebook.com/plugins/',
  'instagram.com/',
  'linkedin.com/embed/',
  'platform.twitter.com/',
  'assets.pinterest.com/ext/embed.html',
  'threads.net',
  'threads.com',
  '/video/',
  '/reel/',
  '/shorts/',
  '/clips/',
  'instagram.com/reel',
  'instagram.com/reels',
];

function isPlayableIframe(iframe: HTMLIFrameElement): boolean {
  const src = (iframe.getAttribute('src') || '').toLowerCase();
  const allow = (iframe.getAttribute('allow') || '').toLowerCase();

  if (!src || src === 'about:blank') return false;
  if (allow.includes('autoplay')) return true;

  return PLAYABLE_IFRAME_HINTS.some((hint) => src.includes(hint));
}

function hasPlayableMedia(root: HTMLElement): boolean {
  if (root.querySelector(PLAYABLE_MEDIA_SELECTOR)) return true;
  return Array.from(root.querySelectorAll<HTMLIFrameElement>('iframe')).some(isPlayableIframe);
}

function hasLifecycleTargets(root: HTMLElement): boolean {
  return hasPlayableMedia(root) || root.querySelector(SUSPENDED_IFRAME_SELECTOR) !== null;
}

function getHardSuspendDistancePx(hardSuspendDistanceVh: number): number {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return Math.max(Math.round(hardSuspendDistanceVh * vh), HARD_SUSPEND_MIN_DISTANCE_PX);
}

function getActiveDistancePx(): number {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return Math.min(Math.max(Math.round(vh * 0.45), 80), 220);
}

// ── Stage A helpers: pause only, preserve visuals ──────────────────────

function pauseNativeMedia(root: HTMLElement) {
  root.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
    if (!el.paused) el.pause();
  });
}

function pauseYouTubeIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>(YOUTUBE_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } catch { /* cross-origin */ }
  });
}

function pauseSpotifyIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>(SPOTIFY_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
    } catch { /* cross-origin */ }
  });
}

/** Stage A: pause native/API media only — keep non-API visuals mounted */
function stageAPause(root: HTMLElement) {
  pauseNativeMedia(root);
  pauseYouTubeIframes(root);
  pauseSpotifyIframes(root);
}

// ── Stage B helpers: hard suspend / restore ────────────────────────────

function hardSuspendIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!isPlayableIframe(iframe)) return;
    if (iframe.dataset[SUSPENDED_FLAG] === '1') return;

    const src = iframe.getAttribute('src');
    if (!src || src === 'about:blank') return;

    iframe.dataset[SUSPENDED_SRC] = src;
    iframe.dataset[SUSPENDED_FLAG] = '1';
    iframe.setAttribute('src', 'about:blank');
    iframe.style.visibility = 'hidden';
  });
}

function restoreHardSuspended(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[SUSPENDED_FLAG] !== '1') return;

    const storedSrc = iframe.dataset[SUSPENDED_SRC];
    if (storedSrc) {
      iframe.setAttribute('src', storedSrc);
    }

    delete iframe.dataset[SUSPENDED_FLAG];
    delete iframe.dataset[SUSPENDED_SRC];
    iframe.style.visibility = '';
  });
}

// ── Lifecycle states ───────────────────────────────────────────────────

type LifecycleState = 'active' | 'paused' | 'suspended';

interface MediaLifecycleOptions {
  /** Enable lifecycle for this post. Should be true only for playable media posts. */
  enabled?: boolean;
  /** Stage B threshold in viewport heights. A pixel floor is also applied for tiny screens. */
  hardSuspendDistanceVh?: number;
  /** When true, skip Stage B (hard-suspend) entirely — embeds stay loaded for the session. */
  disableHardSuspend?: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean,
  options: MediaLifecycleOptions = {}
) {
  const { enabled = true, hardSuspendDistanceVh = 6, disableHardSuspend = false } = options;
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>('active');
  const stateRef = useRef<LifecycleState>('active');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!enabled) {
      restoreHardSuspended(el);
      stateRef.current = 'active';
      setLifecycleState('active');
      return;
    }

    let rafId: number | null = null;
    let mutationRaf: number | null = null;

    const computeZone = (): 'visible' | 'near' | 'far' => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const viewportCenterY = vh / 2;
      const hardSuspendDistancePx = getHardSuspendDistancePx(hardSuspendDistanceVh);
      const activeDistancePx = getActiveDistancePx();

      const isOnScreen = rect.bottom > 0 && rect.top < vh;
      const embedCenterY = rect.top + rect.height / 2;
      const distanceToViewportCenter = Math.abs(embedCenterY - viewportCenterY);

      if (isOnScreen && distanceToViewportCenter <= activeDistancePx) {
        return 'visible';
      }

      if (rect.bottom > -hardSuspendDistancePx && rect.top < vh + hardSuspendDistancePx) {
        return 'near';
      }

      return 'far';
    };

    const transition = (target: LifecycleState) => {
      const current = stateRef.current;
      if (current === target) return;

      const currentEl = containerRef.current;
      if (!currentEl) return;

      if (!hasLifecycleTargets(currentEl) && target !== 'active') {
        stateRef.current = 'active';
        setLifecycleState('active');
        return;
      }

      if (target === 'active') {
        restoreHardSuspended(currentEl);
      } else if (target === 'paused') {
        if (current === 'suspended') {
          restoreHardSuspended(currentEl);
        }
        stageAPause(currentEl);
      } else if (target === 'suspended') {
        if (disableHardSuspend) {
          // Skip hard-suspend — just pause media, keep embeds loaded
          stageAPause(currentEl);
          stateRef.current = 'paused';
          setLifecycleState('paused');
          return;
        }
        if (current === 'active') {
          stageAPause(currentEl);
        }
        hardSuspendIframes(currentEl);
      }

      stateRef.current = target;
      setLifecycleState(target);
    };

    const reconcile = () => {
      const zone = computeZone();
      if (zone === 'visible') transition('active');
      else if (zone === 'near') transition('paused');
      else transition('suspended');
    };

    const scheduleReconcile = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        reconcile();
      });
    };

    const scheduleMutationCheck = () => {
      if (mutationRaf !== null) return;
      mutationRaf = requestAnimationFrame(() => {
        mutationRaf = null;
        const currentEl = containerRef.current;
        if (!currentEl) return;

        if (hasPlayableMedia(currentEl)) {
          reconcile();
        }
      });
    };

    const hardSuspendDistancePx = getHardSuspendDistancePx(hardSuspendDistanceVh);

    const nearObserver = new IntersectionObserver(() => scheduleReconcile(), {
      rootMargin: `${hardSuspendDistancePx}px 0px ${hardSuspendDistancePx}px 0px`,
      threshold: 0,
    });

    const viewportObserver = new IntersectionObserver(() => scheduleReconcile(), {
      threshold: [0, 0.1],
    });

    const mutationObserver = new MutationObserver(() => scheduleMutationCheck());

    nearObserver.observe(el);
    viewportObserver.observe(el);
    mutationObserver.observe(el, { childList: true, subtree: true });

    document.addEventListener('scroll', scheduleReconcile, true);
    window.addEventListener('resize', scheduleReconcile);

    reconcile();

    return () => {
      nearObserver.disconnect();
      viewportObserver.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener('scroll', scheduleReconcile, true);
      window.removeEventListener('resize', scheduleReconcile);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (mutationRaf !== null) cancelAnimationFrame(mutationRaf);
    };
  }, [containerRef, observeKey, enabled, hardSuspendDistanceVh]);

  useEffect(() => {
    if (!enabled) {
      prevPathRef.current = location.pathname;
      return;
    }

    if (location.pathname !== prevPathRef.current) {
      const el = containerRef.current;
      if (el && hasPlayableMedia(el)) {
        stageAPause(el);
        hardSuspendIframes(el);
        stateRef.current = 'suspended';
        setLifecycleState('suspended');
      }
      prevPathRef.current = location.pathname;
    }
  }, [enabled, location.pathname, containerRef]);

  return lifecycleState;
}

/**
 * Global route-change media killer.
 * Mount once at app level to pause ALL playable media on any navigation.
 */
export function useGlobalMediaPauseOnNavigate() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
        if (!el.paused) el.pause();
      });

      document.querySelectorAll<HTMLIFrameElement>(YOUTUBE_SELECTOR).forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
        } catch { /* cross-origin */ }
      });

      document.querySelectorAll<HTMLIFrameElement>(SPOTIFY_SELECTOR).forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
        } catch { /* cross-origin */ }
      });

      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
