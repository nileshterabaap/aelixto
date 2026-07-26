import { useEffect, useRef, RefObject } from 'react';
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
 *   - Restore them early when they come back near the viewport
 *
 * Performance: uses TWO shared IntersectionObservers + ONE resize listener
 * for ALL registered posts, instead of per-post observers.
 */

// ── Selectors ──────────────────────────────────────────────────────────

const YOUTUBE_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_SELECTOR = 'iframe[src*="open.spotify.com"]';
const SUSPENDED_IFRAME_SELECTOR = 'iframe[data-aelix-suspended="1"]';
const HARD_SUSPEND_MIN_DISTANCE_PX = 2800;

const SUSPENDED_FLAG = 'aelixSuspended';
const SUSPENDED_SRC = 'aelixSuspendedSrc';
const FROZEN_FLAG = 'aelixFrozen';

const API_PAUSABLE_SELECTOR = [YOUTUBE_SELECTOR, SPOTIFY_SELECTOR].join(', ');

// ── Detection ─────────────────────────────────────────────────────────

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

// ── Stage A helpers ───────────────────────────────────────────────────

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

// ── Mute/unmute helpers ───────────────────────────────────────────────

const MUTE_FLAG = 'aelixMuted';

function muteNonApiIframe(iframe: HTMLIFrameElement) {
  if (iframe.dataset[MUTE_FLAG] === '1') return;
  iframe.dataset[MUTE_FLAG] = '1';
  iframe.style.pointerEvents = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
}

function muteNonApiIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!isPlayableIframe(iframe)) return;
    if (iframe.matches(API_PAUSABLE_SELECTOR)) return;
    muteNonApiIframe(iframe);
  });
}

function freezeIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[SUSPENDED_FLAG] === '1') return;
    if (iframe.dataset[FROZEN_FLAG] === '1') return;
    iframe.dataset[FROZEN_FLAG] = '1';
    iframe.style.pointerEvents = 'none';
  });
}

function unfreezeIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[FROZEN_FLAG] !== '1') return;
    delete iframe.dataset[FROZEN_FLAG];
    iframe.style.pointerEvents = '';
  });
}

function stageAPause(root: HTMLElement) {
  pauseNativeMedia(root);
  pauseYouTubeIframes(root);
  pauseSpotifyIframes(root);
  if (root.dataset.aelixHasBeenActive) {
    muteNonApiIframes(root);
  }
  freezeIframes(root);
}

function stageAResume(root: HTMLElement) {
  restoreHardSuspended(root);
  root.dataset.aelixHasBeenActive = 'true';
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[MUTE_FLAG] === '1') {
      // Undo the mute side-effects, otherwise the iframe stays
      // pointer-events:none forever and taps (e.g. Threads play) never land.
      iframe.style.pointerEvents = '';
      iframe.removeAttribute('aria-hidden');
      iframe.removeAttribute('tabindex');
    }
    delete iframe.dataset[MUTE_FLAG];
  });
  unfreezeIframes(root);
}

// ── Stage B helpers ───────────────────────────────────────────────────

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
    if (storedSrc) iframe.setAttribute('src', storedSrc);
    delete iframe.dataset[SUSPENDED_FLAG];
    delete iframe.dataset[SUSPENDED_SRC];
    iframe.style.visibility = '';
  });
}

// ── Shared observer registry ──────────────────────────────────────────
// Instead of 2 IntersectionObservers + 1 resize listener PER POST,
// we maintain 2 shared observers + 1 resize listener for ALL posts.

type LifecycleState = 'active' | 'paused' | 'suspended';

interface RegisteredElement {
  near: boolean;
  active: boolean;
  state: LifecycleState;
  disableHardSuspend: boolean;
}

const elementStates = new Map<HTMLElement, RegisteredElement>();

let sharedNearObserver: IntersectionObserver | null = null;
let sharedActiveObserver: IntersectionObserver | null = null;
let sharedResizeHandler: (() => void) | null = null;
let observerRefCount = 0;

function transitionElement(el: HTMLElement, reg: RegisteredElement, target: LifecycleState) {
  const current = reg.state;
  if (current === target) return;

  if (target === 'active') {
    stageAResume(el);
  } else if (target === 'paused') {
    if (current === 'suspended') restoreHardSuspended(el);
    stageAPause(el);
  } else if (target === 'suspended') {
    if (reg.disableHardSuspend) {
      stageAPause(el);
      reg.state = 'paused';
      return;
    }
    if (current === 'active') stageAPause(el);
    hardSuspendIframes(el);
  }

  reg.state = target;
}

function reconcileElement(el: HTMLElement, reg: RegisteredElement) {
  if (reg.active) transitionElement(el, reg, 'active');
  else if (reg.near) transitionElement(el, reg, 'paused');
  else transitionElement(el, reg, 'suspended');
}

function ensureSharedObservers() {
  if (sharedNearObserver) return;

  const hardDist = getHardSuspendDistancePx(6);
  const activeDist = getActiveDistancePx();

  sharedNearObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const reg = elementStates.get(entry.target as HTMLElement);
      if (!reg) continue;
      reg.near = entry.isIntersecting;
      reconcileElement(entry.target as HTMLElement, reg);
    }
  }, {
    rootMargin: `${hardDist}px 0px ${hardDist}px 0px`,
    threshold: 0,
  });

  sharedActiveObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const reg = elementStates.get(entry.target as HTMLElement);
      if (!reg) continue;
      reg.active = entry.isIntersecting;
      reconcileElement(entry.target as HTMLElement, reg);
    }
  }, {
    rootMargin: `-${activeDist}px 0px -${activeDist}px 0px`,
    threshold: 0,
  });

  sharedResizeHandler = () => {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const hd = getHardSuspendDistancePx(6);
    const ad = getActiveDistancePx();
    elementStates.forEach((reg, el) => {
      const rect = el.getBoundingClientRect();
      reg.near = rect.bottom > -hd && rect.top < vh + hd;
      reg.active = rect.bottom > ad && rect.top < vh - ad;
      reconcileElement(el, reg);
    });
  };

  window.addEventListener('resize', sharedResizeHandler);
}

function destroySharedObservers() {
  sharedNearObserver?.disconnect();
  sharedActiveObserver?.disconnect();
  if (sharedResizeHandler) window.removeEventListener('resize', sharedResizeHandler);
  sharedNearObserver = null;
  sharedActiveObserver = null;
  sharedResizeHandler = null;
}

function registerElement(el: HTMLElement, disableHardSuspend: boolean) {
  ensureSharedObservers();
  observerRefCount++;

  const reg: RegisteredElement = { near: false, active: false, state: 'active', disableHardSuspend };
  elementStates.set(el, reg);
  sharedNearObserver!.observe(el);
  sharedActiveObserver!.observe(el);

  // Sync initial state from layout
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const hardDist = getHardSuspendDistancePx(6);
  const activeDist = getActiveDistancePx();
  const rect = el.getBoundingClientRect();
  reg.near = rect.bottom > -hardDist && rect.top < vh + hardDist;
  reg.active = rect.bottom > activeDist && rect.top < vh - activeDist;
  reconcileElement(el, reg);
}

function unregisterElement(el: HTMLElement) {
  elementStates.delete(el);
  sharedNearObserver?.unobserve(el);
  sharedActiveObserver?.unobserve(el);
  observerRefCount--;

  if (observerRefCount <= 0) {
    observerRefCount = 0;
    destroySharedObservers();
  }
}

// ── Hook options ──────────────────────────────────────────────────────

interface MediaLifecycleOptions {
  enabled?: boolean;
  hardSuspendDistanceVh?: number;
  disableHardSuspend?: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean,
  options: MediaLifecycleOptions = {}
) {
  const { enabled = true, disableHardSuspend = false } = options;
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!enabled) {
      restoreHardSuspended(el);
      return;
    }

    registerElement(el, disableHardSuspend);
    return () => unregisterElement(el);
  }, [containerRef, observeKey, enabled, disableHardSuspend]);

  // Route-change pause
  useEffect(() => {
    if (!enabled) {
      prevPathRef.current = location.pathname;
      return;
    }

    if (location.pathname !== prevPathRef.current) {
      const el = containerRef.current;
      if (el && hasPlayableMedia(el)) {
        stageAPause(el);
        if (!disableHardSuspend) hardSuspendIframes(el);
        const reg = elementStates.get(el);
        if (reg) reg.state = disableHardSuspend ? 'paused' : 'suspended';
      }
      prevPathRef.current = location.pathname;
    }
  }, [enabled, location.pathname, containerRef, disableHardSuspend]);
}

// ── Global route-change media killer ──────────────────────────────────

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
