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

// ── Detection: does this container have playable media? ────────────────

const PLAYABLE_MEDIA_SELECTOR = [
  'video',
  'audio',
  'iframe[src*="youtube.com"]',
  'iframe[src*="youtube-nocookie.com"]',
  'iframe[src*="open.spotify.com"]',
  'iframe[src*="tiktok.com"]',
  'iframe[src*="instagram.com"]',
  'iframe[src*="facebook.com"]',
  'iframe[src*="fb.watch"]',
  'iframe[src*="twitter.com"]',
  'iframe[src*="x.com"]',
  'iframe[src*="threads.net"]',
  'iframe[src*="linkedin.com"]',
  'iframe[src*="pinterest.com"]',
  'iframe[src*="vimeo.com"]',
  'iframe[src*="reddit.com"]',
].join(', ');

function hasPlayableMedia(root: HTMLElement): boolean {
  return root.querySelector(PLAYABLE_MEDIA_SELECTOR) !== null;
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

/** Freeze non-API iframes by hiding them visually (stops rendering/playback in most browsers) */
function freezeIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
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

// ── Hook ───────────────────────────────────────────────────────────────

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean
) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const stateRef = useRef<LifecycleState>('active');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    let mutationRaf: number | null = null;

    // Determine viewport-relative distance zones
    const computeZone = (): 'visible' | 'near' | 'far' => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // Visible = intersecting viewport
      if (rect.bottom > 0 && rect.top < vh) return 'visible';

      // Near = within ~1.5 viewport heights
      const nearMargin = vh * 1.5;
      if (rect.bottom > -nearMargin && rect.top < vh + nearMargin) return 'near';

      // Far = beyond 1.5 viewport heights
      return 'far';
    };

    const transition = (target: LifecycleState) => {
      const current = stateRef.current;
      if (current === target) return;
      const currentEl = containerRef.current;
      if (!currentEl) return;

      // Only run lifecycle on containers with playable media
      if (!hasPlayableMedia(currentEl)) {
        stateRef.current = target;
        return;
      }

      if (target === 'active') {
        // Restore from whatever state we were in
        if (current === 'suspended') {
          restoreHardSuspended(currentEl);
        } else if (current === 'paused') {
          stageAResume(currentEl);
        }
      } else if (target === 'paused') {
        if (current === 'suspended') {
          // Coming back from far → near: restore hard-suspended, then freeze
          restoreHardSuspended(currentEl);
          // Small delay to let iframe reload before freezing
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
        // If we're not active and new playable media appeared, reconcile
        if (stateRef.current !== 'active' && hasPlayableMedia(currentEl)) {
          reconcile();
        }
      });
    };

    // IntersectionObserver with expanded margins for the "far" zone detection
    const nearObserver = new IntersectionObserver(
      () => scheduleReconcile(),
      { rootMargin: '150% 0px' } // triggers when entering/leaving ~1.5vh zone
    );

    const viewportObserver = new IntersectionObserver(
      () => scheduleReconcile(),
      { threshold: [0, 0.1] }
    );

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
  }, [containerRef, observeKey]);

  // Route change — pause everything in this container
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      const el = containerRef.current;
      if (el && hasPlayableMedia(el)) {
        stageAPause(el);
        hardSuspendIframes(el);
        stateRef.current = 'suspended';
      }
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, containerRef]);
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
