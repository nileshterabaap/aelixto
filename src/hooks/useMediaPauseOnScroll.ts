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

/** Container attribute set once the user has actually started media in this embed. */
const PLAYED_ATTR = 'data-aelix-played';

/**
 * Dwell required in the far ring before an embed is allowed to go dormant.
 * Prevents rapid scrolling from ever recreating an iframe.
 */
const DORMANT_DWELL_MS = 1200;

/** Suppress dormancy transitions entirely while the user is flinging. */
const FLING_VELOCITY_PX_S = 800;

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
    // Pin the current box before blanking so the restore can never shift layout.
    const rect = iframe.getBoundingClientRect();
    if (rect.height > 0 && !iframe.style.height) {
      iframe.dataset.aelixPinnedHeight = '1';
      iframe.style.height = `${Math.round(rect.height)}px`;
    }
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
    if (iframe.dataset.aelixPinnedHeight === '1') {
      delete iframe.dataset.aelixPinnedHeight;
      iframe.style.height = '';
    }
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
  /** Pending dormancy timer (hysteresis). */
  dormantTimer: number | null;
  /** Detach the played-detection listeners. */
  detachPlayWatch?: () => void;
}

const elementStates = new Map<HTMLElement, RegisteredElement>();

let sharedNearObserver: IntersectionObserver | null = null;
let sharedActiveObserver: IntersectionObserver | null = null;
let sharedResizeHandler: (() => void) | null = null;
let sharedVelocityHandler: (() => void) | null = null;
let sharedVisibilityHandler: (() => void) | null = null;
let observerRefCount = 0;

// ── Played detection + fling gate ─────────────────────────────────────

function hasBeenPlayed(el: HTMLElement): boolean {
  return el.getAttribute(PLAYED_ATTR) === '1';
}

export function markEmbedPlayed(el: HTMLElement | null | undefined) {
  if (!el) return;
  const host = el.closest('[data-embed-lifecycle]') as HTMLElement | null;
  (host || el).setAttribute(PLAYED_ATTR, '1');
}

/**
 * Observes (never intercepts) the signals that mean "media actually started"
 * in this embed: a native media `play`, or a pointer landing inside a
 * cross-origin iframe. Purely passive/capture — scoring paths are untouched.
 */
function attachPlayWatch(el: HTMLElement): () => void {
  const onPlay = () => el.setAttribute(PLAYED_ATTR, '1');
  const onPointerDown = (e: Event) => {
    const target = e.target as Element | null;
    if (!target) return;
    if (target.tagName === 'IFRAME' || target.closest('iframe')) {
      el.setAttribute(PLAYED_ATTR, '1');
    }
  };
  el.addEventListener('play', onPlay, { capture: true, passive: true });
  el.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  el.addEventListener('touchstart', onPointerDown, { capture: true, passive: true });
  return () => {
    el.removeEventListener('play', onPlay, true);
    el.removeEventListener('pointerdown', onPointerDown, true);
    el.removeEventListener('touchstart', onPointerDown, true);
  };
}

let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
let lastScrollAt = 0;
let flingUntil = 0;

function isFlinging(): boolean {
  return Date.now() < flingUntil;
}

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

function clearDormantTimer(reg: RegisteredElement) {
  if (reg.dormantTimer !== null) {
    window.clearTimeout(reg.dormantTimer);
    reg.dormantTimer = null;
  }
}

/**
 * Ring C entry. Gated by:
 *  - dwell (the element must stay far away for DORMANT_DWELL_MS),
 *  - no active fling,
 *  - the embed must have actually been played (or the tab is backgrounded).
 * Anything that fails a gate simply stays in ring B ("paused"), which is
 * flicker-free because the iframe document is never touched.
 */
function scheduleDormant(el: HTMLElement, reg: RegisteredElement) {
  if (reg.disableHardSuspend) {
    transitionElement(el, reg, 'paused');
    return;
  }
  if (reg.state === 'suspended' || reg.dormantTimer !== null) return;

  // Always stop what we can immediately; recreation is the slow path only.
  transitionElement(el, reg, 'paused');

  const eligible = () => hasBeenPlayed(el) || document.visibilityState === 'hidden';
  if (!eligible()) return;

  const delay = document.visibilityState === 'hidden' ? 0 : DORMANT_DWELL_MS;
  reg.dormantTimer = window.setTimeout(() => {
    reg.dormantTimer = null;
    if (reg.near || reg.active) return;
    if (isFlinging()) {
      // Re-arm after the fling settles instead of recreating mid-scroll.
      scheduleDormant(el, reg);
      return;
    }
    if (!eligible()) return;
    transitionElement(el, reg, 'suspended');
  }, delay);
}

function reconcileElement(el: HTMLElement, reg: RegisteredElement) {
  if (reg.active) {
    clearDormantTimer(reg);
    transitionElement(el, reg, 'active');
  } else if (reg.near) {
    // Restoring here gives ~6 screens of runway before the embed is visible,
    // so a recreated iframe finishes loading entirely off-screen.
    clearDormantTimer(reg);
    transitionElement(el, reg, 'paused');
  } else {
    scheduleDormant(el, reg);
  }
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

  sharedVelocityHandler = () => {
    const now = Date.now();
    const y = window.scrollY;
    const dt = now - lastScrollAt;
    if (dt > 0 && dt < 400) {
      const velocity = (Math.abs(y - lastScrollY) / dt) * 1000;
      if (velocity > FLING_VELOCITY_PX_S) flingUntil = now + 250;
    }
    lastScrollY = y;
    lastScrollAt = now;
  };
  window.addEventListener('scroll', sharedVelocityHandler, { passive: true });

  sharedVisibilityHandler = () => {
    const hidden = document.visibilityState === 'hidden';
    elementStates.forEach((reg, el) => {
      if (hidden) {
        stageAPause(el);
        if (reg.state === 'active') reg.state = 'paused';
        if (!reg.near && !reg.active) {
          clearDormantTimer(reg);
          scheduleDormant(el, reg);
        }
      } else {
        reconcileElement(el, reg);
      }
    });
  };
  document.addEventListener('visibilitychange', sharedVisibilityHandler);
}

function destroySharedObservers() {
  sharedNearObserver?.disconnect();
  sharedActiveObserver?.disconnect();
  if (sharedResizeHandler) window.removeEventListener('resize', sharedResizeHandler);
  if (sharedVelocityHandler) window.removeEventListener('scroll', sharedVelocityHandler);
  if (sharedVisibilityHandler) document.removeEventListener('visibilitychange', sharedVisibilityHandler);
  sharedNearObserver = null;
  sharedActiveObserver = null;
  sharedResizeHandler = null;
  sharedVelocityHandler = null;
  sharedVisibilityHandler = null;
}

function registerElement(el: HTMLElement, disableHardSuspend: boolean) {
  ensureSharedObservers();
  observerRefCount++;

  const reg: RegisteredElement = {
    near: false,
    active: false,
    state: 'active',
    disableHardSuspend,
    dormantTimer: null,
  };
  el.setAttribute('data-embed-lifecycle', '1');
  reg.detachPlayWatch = attachPlayWatch(el);
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
  const reg = elementStates.get(el);
  if (reg) {
    clearDormantTimer(reg);
    reg.detachPlayWatch?.();
  }
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
