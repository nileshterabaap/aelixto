import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Two-stage media lifecycle for playable media only.
 *
 * Stage A (near viewport, 0–1 viewport away):
 *   - Pause native <video>/<audio> via .pause()
 *   - Pause YouTube via postMessage pauseVideo
 *   - Pause Spotify via postMessage { command: 'pause' }
 *   - Freeze other iframes via visibility:hidden (no src change)
 *
 * Stage B (far from viewport, 2–3 viewport heights away):
 *   - Hard-suspend iframes: swap src → about:blank, store original
 *
 * Only applies to containers with playable media (video, audio, YouTube,
 * Spotify, TikTok, Instagram reels, etc.). Static embeds are ignored.
 */

// ── Selectors ──────────────────────────────────────────────────────────

const YOUTUBE_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_SELECTOR = 'iframe[src*="open.spotify.com"]';

/** Iframes that have their own postMessage pause API — never hard-suspend these in stage A */
const API_PAUSABLE_SELECTOR = [YOUTUBE_SELECTOR, SPOTIFY_SELECTOR].join(', ');

// ── Data attributes for hard-suspend bookkeeping ───────────────────────

const SUSPENDED_FLAG = 'aelixSuspended';
const SUSPENDED_SRC = 'aelixSuspendedSrc';
const FROZEN_FLAG = 'aelixFrozen';

// ── Detection: does this container currently contain playable media? ─────

const PLAYABLE_MEDIA_SELECTOR = 'video, audio';
const SUSPENDED_IFRAME_SELECTOR = 'iframe[data-aelix-suspended="1"]';
const PLAYABLE_IFRAME_HINTS = [
  'youtube.com',
  'youtube-nocookie.com',
  'open.spotify.com/embed',
  'tiktok.com/embed',
  'facebook.com/plugins/video.php',
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

// ── Stage A helpers: soft pause / freeze ───────────────────────────────

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

/** Freeze non-API playable iframes by hiding them visually (no reload) */
function freezeIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!isPlayableIframe(iframe)) return;
    // Skip iframes that have their own pause API
    if (iframe.matches(API_PAUSABLE_SELECTOR)) return;
    // Skip already frozen or hard-suspended
    if (iframe.dataset[FROZEN_FLAG] === '1' || iframe.dataset[SUSPENDED_FLAG] === '1') return;

    iframe.dataset[FROZEN_FLAG] = '1';
    iframe.style.visibility = 'hidden';
  });
}

/** Unfreeze iframes that were only soft-frozen (not hard-suspended) */
function unfreezeIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[FROZEN_FLAG] !== '1') return;

    delete iframe.dataset[FROZEN_FLAG];
    iframe.style.visibility = '';
  });
}

/** Stage A: soft pause everything */
function stageAPause(root: HTMLElement) {
  pauseNativeMedia(root);
  pauseYouTubeIframes(root);
  pauseSpotifyIframes(root);
  freezeIframes(root);
}

/** Undo Stage A freeze (restore visibility) */
function stageAResume(root: HTMLElement) {
  unfreezeIframes(root);
}

// ── Stage B helpers: hard suspend / restore ────────────────────────────

function hardSuspendIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!isPlayableIframe(iframe)) return;
    if (iframe.dataset[SUSPENDED_FLAG] === '1') return;

    const src = iframe.getAttribute('src');
    if (!src || src === 'about:blank') return;

    // Store original src
    iframe.dataset[SUSPENDED_SRC] = src;
    iframe.dataset[SUSPENDED_FLAG] = '1';
    // Also clear frozen flag since we're escalating
    delete iframe.dataset[FROZEN_FLAG];

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
    delete iframe.dataset[FROZEN_FLAG];
    iframe.style.visibility = '';
  });
}

// ── Lifecycle states ───────────────────────────────────────────────────

type LifecycleState = 'active' | 'paused' | 'suspended';

interface MediaLifecycleOptions {
  /** Enable lifecycle for this post. Should be true only for playable media posts. */
  enabled?: boolean;
  /** Stage B threshold in viewport heights. Default: 2.5vh away from viewport. */
  hardSuspendDistanceVh?: number;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean,
  options: MediaLifecycleOptions = {}
) {
  const { enabled = true, hardSuspendDistanceVh = 2.5 } = options;
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const stateRef = useRef<LifecycleState>('active');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If lifecycle is disabled for this post, always keep media active/restored.
    if (!enabled) {
      restoreHardSuspended(el);
      stageAResume(el);
      stateRef.current = 'active';
      return;
    }

    let rafId: number | null = null;
    let mutationRaf: number | null = null;

    // Determine viewport-relative distance zones
    const computeZone = (): 'visible' | 'near' | 'far' => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;

      const visibleTop = Math.max(rect.top, 0);
      const visibleBottom = Math.min(rect.bottom, vh);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const postHeight = rect.height || 1;
      const visibleRatio = visibleHeight / postHeight;

      // Keep exactly one "primary" post active: the one crossing viewport center.
      // This pauses Post 1 as soon as Post 2 becomes the primary card.
      const viewportCenterY = vh * 0.5;
      const crossesViewportCenter = rect.top <= viewportCenterY && rect.bottom >= viewportCenterY;
      const minVisibleForCenter = Math.max(64, Math.min(vh, postHeight) * 0.25);
      if (crossesViewportCenter && visibleHeight >= minVisibleForCenter) return 'visible';

      // Fallback for very short cards fully shown on screen.
      if (visibleRatio >= 0.6) return 'visible';

      // Near = around viewport (soft pause only)
      const nearMargin = 80;
      if (rect.bottom > -nearMargin && rect.top < vh + nearMargin) return 'near';

      // Far = hard-suspend when sufficiently distant
      const farDistancePx = Math.max(1, hardSuspendDistanceVh) * vh;
      if (rect.bottom > -farDistancePx && rect.top < vh + farDistancePx) return 'near';

      return 'far';
    };

    const transition = (target: LifecycleState) => {
      const current = stateRef.current;
      if (current === target) return;

      const currentEl = containerRef.current;
      if (!currentEl) return;

      // Never pause/suspend containers without playable media.
      // But still allow active transitions so previously suspended iframes can restore.
      if (!hasLifecycleTargets(currentEl) && target !== 'active') {
        stateRef.current = 'active';
        return;
      }

      if (target === 'active') {
        if (current === 'suspended') {
          restoreHardSuspended(currentEl);
        }
        stageAResume(currentEl);
      } else if (target === 'paused') {
        if (current === 'suspended') {
          // Far -> near: restore iframe src once, then apply Stage A freeze/pause.
          restoreHardSuspended(currentEl);
          stageAPause(currentEl);
        } else if (current === 'active') {
          stageAPause(currentEl);
        }
      } else if (target === 'suspended') {
        if (current === 'active') {
          stageAPause(currentEl);
        }
        hardSuspendIframes(currentEl);
      }

      stateRef.current = target;
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

        // Reconcile whenever media nodes are injected (late hydration / SDK render).
        if (hasPlayableMedia(currentEl)) {
          reconcile();
        }
      });
    };

    const nearObserver = new IntersectionObserver(() => scheduleReconcile(), {
      rootMargin: `${Math.round(Math.max(2, hardSuspendDistanceVh) * 100)}% 0px`,
    });

    const viewportObserver = new IntersectionObserver(() => scheduleReconcile(), {
      threshold: [0, 0.1],
    });

    const mutationObserver = new MutationObserver(() => scheduleMutationCheck());

    nearObserver.observe(el);
    viewportObserver.observe(el);
    mutationObserver.observe(el, { childList: true, subtree: true });

    // Scroll/resize fallback for edge cases
    document.addEventListener('scroll', scheduleReconcile, true);
    window.addEventListener('resize', scheduleReconcile);

    // Initial state
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

  // Route change — pause everything in this container (playable posts only)
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
      }
      prevPathRef.current = location.pathname;
    }
  }, [enabled, location.pathname, containerRef]);
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
      // Pause native media
      document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
        if (!el.paused) el.pause();
      });
      // Pause YouTube
      document.querySelectorAll<HTMLIFrameElement>(YOUTUBE_SELECTOR).forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
        } catch { /* cross-origin */ }
      });
      // Pause Spotify
      document.querySelectorAll<HTMLIFrameElement>(SPOTIFY_SELECTOR).forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
        } catch { /* cross-origin */ }
      });
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
