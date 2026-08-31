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
 * Stage B (leaving viewport):
 *   - Hard-suspend playable iframes by swapping src → about:blank
 *   - Restore them early only when scroll direction shows they are approaching
 *     the viewport again, so upward scrolls stop audio just like downward scrolls
 *
 * Performance: uses TWO shared IntersectionObservers + ONE resize listener
 * for ALL registered posts, instead of per-post observers.
 */

// ── Selectors ──────────────────────────────────────────────────────────

const YOUTUBE_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_SELECTOR = 'iframe[src*="open.spotify.com"]';
const VIMEO_SELECTOR = 'iframe[src*="player.vimeo.com"]';
const SUSPENDED_IFRAME_SELECTOR = 'iframe[data-aelix-suspended="1"]';


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

/**
 * Distance BELOW the viewport at which a suspended post starts pre-warming
 * (hidden reload). Must stay generous so the embed is live before it is seen.
 */
function getPrewarmDistancePx(): number {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return Math.min(Math.max(Math.round(vh * 1.5), 700), 1200);
}



function getActiveDistancePx(): number {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return Math.min(Math.max(Math.round(vh * 0.45), 80), 220);
}

/**
 * The feed's usable viewport excludes UI that visually covers posts. A played
 * embed should be suspended as soon as it passes behind the sticky header or
 * fixed bottom navigation, rather than after it has travelled beyond the raw
 * browser viewport.
 */
function getUsableViewportBounds(): { top: number; bottom: number } {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const header = document.querySelector<HTMLElement>('header');
  const bottomNav = document.querySelector<HTMLElement>('nav.fixed.bottom-0');
  const headerRect = header?.getBoundingClientRect();
  const bottomNavRect = bottomNav?.getBoundingClientRect();

  const top = headerRect && headerRect.bottom > 0 && headerRect.top <= 0
    ? Math.min(headerRect.bottom, vh)
    : 0;
  const bottom = bottomNavRect && bottomNavRect.top > 0 && bottomNavRect.top < vh
    ? bottomNavRect.top
    : vh;

  return { top, bottom: Math.max(top, bottom) };
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

function pauseVimeoIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>(VIMEO_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage({ method: 'pause' }, '*');
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
  pauseVimeoIframes(root);
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

// ── Stage B helpers (hard-suspend + pre-warmed restore) ───────────────

const WARMING_FLAG = 'aelixWarming';
const OVERLAY_CLASS = 'aelix-warm-overlay';
const WARM_REVEAL_TIMEOUT_MS = 5000;

/**
 * A confirmed played-video iframe is always hard-suspended off-screen.
 * postMessage pause commands are best-effort only: older/raw YouTube embeds may
 * omit enablejsapi and other providers can silently ignore their pause command.
 * Clearing src is the only provider-independent guarantee that audio stops.
 */
function shouldHardSuspend(iframe: HTMLIFrameElement): boolean {
  // This function is only reached for a post that has emitted a confirmed
  // video_play event. Third-party SDKs frequently generate opaque iframe URLs
  // that cannot be identified reliably, so every non-API iframe in that
  // confirmed video post must be treated as the player.
  return iframe.getAttribute('src') !== 'about:blank';
}

function ensureWarmOverlay(iframe: HTMLIFrameElement) {
  const parent = iframe.parentElement;
  if (!parent) return;
  if (parent.querySelector(`:scope > .${OVERLAY_CLASS}`)) return;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.style.cssText =
    'position:absolute;inset:0;z-index:2;pointer-events:none;background:hsl(var(--muted));opacity:1;transition:opacity 220ms ease-out;';
  parent.appendChild(overlay);
}

function clearWarmOverlay(iframe: HTMLIFrameElement) {
  const parent = iframe.parentElement;
  const overlay = parent?.querySelector<HTMLElement>(`:scope > .${OVERLAY_CLASS}`);
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 260);
}

function revealWarmedIframe(iframe: HTMLIFrameElement) {
  if (iframe.dataset[WARMING_FLAG] !== '1') return;
  delete iframe.dataset[WARMING_FLAG];
  iframe.style.visibility = '';
  clearWarmOverlay(iframe);
}

function hardSuspendIframes(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!shouldHardSuspend(iframe)) return;
    if (iframe.dataset[SUSPENDED_FLAG] === '1') return;
    const src = iframe.getAttribute('src');
    if (!src || src === 'about:blank') return;
    iframe.dataset[SUSPENDED_SRC] = src;
    iframe.dataset[SUSPENDED_FLAG] = '1';
    delete iframe.dataset[WARMING_FLAG];
    iframe.setAttribute('src', 'about:blank');
    iframe.style.visibility = 'hidden';
    // Keep the slot visually filled so the user never sees a blank frame.
    ensureWarmOverlay(iframe);
  });
}

/**
 * Pre-warm: bring the real src back while the post is still off-screen, but
 * keep the frame hidden behind the placeholder overlay until it finishes
 * loading. By the time the post scrolls into view the embed is already live.
 */
function restoreHardSuspended(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[SUSPENDED_FLAG] !== '1') return;
    const storedSrc = iframe.dataset[SUSPENDED_SRC];
    delete iframe.dataset[SUSPENDED_FLAG];
    delete iframe.dataset[SUSPENDED_SRC];

    if (!storedSrc) {
      iframe.style.visibility = '';
      clearWarmOverlay(iframe);
      return;
    }

    iframe.dataset[WARMING_FLAG] = '1';
    iframe.style.visibility = 'hidden';
    ensureWarmOverlay(iframe);

    const onLoad = () => {
      iframe.removeEventListener('load', onLoad);
      // Give the embed SDK a frame to paint before revealing.
      requestAnimationFrame(() => revealWarmedIframe(iframe));
    };
    iframe.addEventListener('load', onLoad);
    // Cross-origin frames don't always fire load — reveal anyway.
    setTimeout(() => revealWarmedIframe(iframe), WARM_REVEAL_TIMEOUT_MS);

    iframe.setAttribute('src', storedSrc);
  });
}


// ── Shared observer registry ──────────────────────────────────────────
// Instead of 2 IntersectionObservers + 1 resize listener PER POST,
// we maintain 2 shared observers + 1 resize listener for ALL posts.

type LifecycleState = 'active' | 'paused' | 'suspended';

interface RegisteredElement {
  visible: boolean;
  prewarm: boolean;
  /**
   * Set when the post is hard-suspended. While true, the post is NOT restored
   * just because it still sits inside the (generous) pre-warm envelope — it
   * must first travel fully outside that envelope. Without this, a played
   * video was reloaded (and audible again) the instant it slipped behind the
   * bottom nav, so audio only really stopped a whole post later.
   */
  awaitingReentry: boolean;
  state: LifecycleState;
  disableHardSuspend: boolean;
  /**
   * One-shot guard: a played video is suspended + pre-warmed exactly ONCE after
   * it leaves the viewport. Until the user taps play again, it then stays
   * loaded and is never reloaded on subsequent scroll passes.
   */
  cycleUsed: boolean;
}


const elementStates = new Map<HTMLElement, RegisteredElement>();

let sharedNearObserver: IntersectionObserver | null = null;
let sharedActiveObserver: IntersectionObserver | null = null;
let sharedResizeHandler: (() => void) | null = null;
let observerRefCount = 0;

function isInsideUsableViewport(rect: DOMRect): boolean {
  const viewport = getUsableViewportBounds();
  return rect.bottom > viewport.top && rect.top < viewport.bottom;
}

function syncElementFromLayout(el: HTMLElement, reg: RegisteredElement) {
  const prewarmDist = getPrewarmDistancePx();
  const rect = el.getBoundingClientRect();
  const viewport = getUsableViewportBounds();

  reg.visible = isInsideUsableViewport(rect);
  reg.prewarm = rect.bottom > viewport.top - prewarmDist && rect.top < viewport.bottom + prewarmDist;
  if (!reg.prewarm) reg.awaitingReentry = false;
  reconcileElement(el, reg);
}

function syncAllElementsFromLayout() {
  // Resize is rare; doing a full layout sync here is safe. Scroll itself is
  // handled entirely by IntersectionObserver and performs no O(posts) reads.
  elementStates.forEach((reg, el) => syncElementFromLayout(el, reg));
}

function transitionElement(el: HTMLElement, reg: RegisteredElement, target: LifecycleState) {
  const current = reg.state;
  if (current === target) return;

  if (target === 'active') {
    stageAResume(el);
  } else if (target === 'paused') {
    if (current === 'suspended') {
      restoreHardSuspended(el);
      // The single allowed refresh has now been spent.
      reg.cycleUsed = true;
    }
    stageAPause(el);
  } else if (target === 'suspended') {
    if (reg.disableHardSuspend || reg.cycleUsed) {
      stageAPause(el);
      reg.state = 'paused';
      return;
    }
    if (current === 'active') stageAPause(el);
    hardSuspendIframes(el);
    reg.awaitingReentry = true;
  }

  reg.state = target;
}

function reconcileElement(el: HTMLElement, reg: RegisteredElement) {
  if (reg.visible) {
    transitionElement(el, reg, 'active');
    return;
  }

  // Never-played posts (and played posts that already spent their one refresh)
  // still receive cheap API/native pause commands, but their iframe is not
  // destroyed or reloaded again.
  if (reg.disableHardSuspend || reg.cycleUsed) {
    transitionElement(el, reg, 'suspended');
    return;
  }

  // A played iframe is killed immediately after leaving the visible feed.
  // Once it has travelled outside the prewarm envelope, the observer restores
  // it on re-entry while it is still well off-screen.
  if (reg.state !== 'suspended') {
    transitionElement(el, reg, 'suspended');
  } else if (reg.prewarm && !reg.awaitingReentry) {
    transitionElement(el, reg, 'paused');
  }
}


function ensureSharedObservers() {
  if (sharedNearObserver) return;

  const prewarmDist = getPrewarmDistancePx();

  sharedNearObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      const reg = elementStates.get(el);
      if (!reg) continue;
      reg.prewarm = entry.isIntersecting;
      // Fully outside the pre-warm envelope → the post is a genuine re-entry
      // candidate again, so the next approach may pre-warm it.
      if (!reg.prewarm) reg.awaitingReentry = false;
      reconcileElement(el, reg);
    }
  }, {
    // Symmetric pre-warm envelope. Direction-aware layout sync below decides
    // whether an offscreen post is approaching (restore) or leaving (suspend).
    rootMargin: `${prewarmDist}px 0px ${prewarmDist}px 0px`,

    threshold: 0,
  });

  sharedActiveObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const reg = elementStates.get(entry.target as HTMLElement);
      if (!reg) continue;
      reg.visible = entry.isIntersecting && isInsideUsableViewport(entry.boundingClientRect);
      reconcileElement(entry.target as HTMLElement, reg);
    }
  }, {
    threshold: 0,
  });

  sharedResizeHandler = () => {
    syncAllElementsFromLayout();
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

const replayListeners = new WeakMap<HTMLElement, (event: Event) => void>();

function registerElement(el: HTMLElement, disableHardSuspend: boolean) {
  ensureSharedObservers();
  observerRefCount++;

  const reg: RegisteredElement = {
    visible: false,
    prewarm: false,
    state: 'active',
    disableHardSuspend,
    cycleUsed: false,
    awaitingReentry: false,
  };
  elementStates.set(el, reg);
  sharedNearObserver!.observe(el);
  sharedActiveObserver!.observe(el);

  // A fresh tap inside the post means the user (re)started playback, so the
  // post earns another suspend + pre-warm cycle.
  const onReplayIntent = () => {
    reg.cycleUsed = false;
  };
  el.addEventListener('pointerdown', onReplayIntent, true);
  el.addEventListener('touchstart', onReplayIntent, { capture: true, passive: true });
  replayListeners.set(el, onReplayIntent);

  // Sync initial state from layout.
  syncElementFromLayout(el, reg);

}

function unregisterElement(el: HTMLElement) {
  elementStates.delete(el);
  sharedNearObserver?.unobserve(el);
  sharedActiveObserver?.unobserve(el);
  const onReplayIntent = replayListeners.get(el);
  if (onReplayIntent) {
    el.removeEventListener('pointerdown', onReplayIntent, true);
    el.removeEventListener('touchstart', onReplayIntent, true);
    replayListeners.delete(el);
  }
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

      // Cross-origin embeds with no pause API (Threads/Meta) keep playing when
      // the user switches tabs, because keep-alive only hides them. Resetting
      // the src is the only way to stop their audio/video.
      document
        .querySelectorAll<HTMLIFrameElement>('iframe[src*="threads.net"], iframe[src*="threads.com"]')
        .forEach((iframe) => {
          const src = iframe.getAttribute('src');
          if (!src || src === 'about:blank') return;
          iframe.setAttribute('src', src);
        });

      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
