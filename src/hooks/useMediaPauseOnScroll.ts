import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { flagOn } from '@/lib/lifecycleFlags';

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
  if (root.dataset.aelixHasBeenActive && flagOn('mute')) {
    muteNonApiIframes(root);
  }
  if (flagOn('freezePointer')) freezeIframes(root);
}

function stageAResume(root: HTMLElement) {
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

const SLEEP_OVERLAY_CLASS = 'aelix-sleep-overlay';

/**
 * "Sleep and stay asleep": a played embed that left the screen is unloaded
 * (audio guaranteed off) and is NEVER reloaded in the background. Records and
 * the switch test showed background restarts were what left X/Threads players
 * stuck or buffering on the next tap. Instead the slot shows a tap-to-load
 * button; tapping it reloads the embed on-screen — the same path as a post
 * opened directly from the grid, which always plays cleanly.
 */
function ensureSleepOverlay(iframe: HTMLIFrameElement) {
  const parent = iframe.parentElement;
  if (!parent) return;
  if (parent.querySelector(`:scope > .${SLEEP_OVERLAY_CLASS}`)) return;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.className = SLEEP_OVERLAY_CLASS;
  overlay.setAttribute('aria-label', 'Tap to load video');
  overlay.style.cssText =
    'position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;' +
    'border:0;padding:0;margin:0;cursor:pointer;background:hsl(var(--muted));color:hsl(var(--muted-foreground));' +
    'font:500 13px/1.2 inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation;';
  overlay.innerHTML =
    '<span style="width:56px;height:56px;border-radius:9999px;display:flex;align-items:center;justify-content:center;' +
    'background:hsl(var(--background));color:hsl(var(--foreground));box-shadow:0 2px 10px hsl(var(--foreground) / 0.15);">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>' +
    '</span><span>Tap to load</span>';
  const stop = (e: Event) => e.stopPropagation();
  overlay.addEventListener('pointerdown', stop);
  overlay.addEventListener('touchstart', stop, { passive: true });
  overlay.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    wakeIframe(iframe, overlay);
  });
  parent.appendChild(overlay);
}

function removeSleepOverlay(iframe: HTMLIFrameElement) {
  iframe.parentElement?.querySelector(`:scope > .${SLEEP_OVERLAY_CLASS}`)?.remove();
}

/** Explicit user wake: reload the embed on-screen, behind a brief loading veil. */
function wakeIframe(iframe: HTMLIFrameElement, overlay: HTMLElement) {
  overlay.remove();
  restoreIframe(iframe);
}

function hardSuspendIframes(root: HTMLElement) {
  if (!flagOn('hardSuspend')) return;
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
    clearWarmOverlay(iframe);
    ensureSleepOverlay(iframe);
  });
}

function restoreIframe(iframe: HTMLIFrameElement) {
  if (iframe.dataset[SUSPENDED_FLAG] !== '1') return;
  const storedSrc = iframe.dataset[SUSPENDED_SRC];
  delete iframe.dataset[SUSPENDED_FLAG];
  delete iframe.dataset[SUSPENDED_SRC];
  removeSleepOverlay(iframe);

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
}

/**
 * Wake every sleeping embed in root. Only used when lifecycle management is
 * switched off for a post — normal scrolling never wakes a sleeping embed.
 */
function restoreHardSuspended(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>(SUSPENDED_IFRAME_SELECTOR).forEach(restoreIframe);
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
  postId: string;
  playbackGeneration: number;
  /**
   * One-shot guard: a played video is suspended + pre-warmed exactly ONCE after
   * it leaves the viewport. Until the user taps play again, it then stays
   * loaded and is never reloaded on subsequent scroll passes.
   */
  cycleUsed: boolean;
  /** Last measured distance (px) between the post and the usable viewport. */
  lastGap?: number;
}


const elementStates = new Map<HTMLElement, RegisteredElement>();
const completedPlaybackCycles = new Map<string, number>();

let sharedNearObserver: IntersectionObserver | null = null;
let sharedActiveObserver: IntersectionObserver | null = null;
let sharedResizeHandler: (() => void) | null = null;
let focusedIframePoll = 0;
let lastFocusedIframe: HTMLIFrameElement | null = null;
let observerRefCount = 0;
let activePlaybackPostId = '';

function onConfirmedPlay(postId: string, playbackGeneration: number) {
  activePlaybackPostId = postId;
  elementStates.forEach((reg, el) => {
    if (!el.isConnected) return;

    if (reg.postId === postId) {
      // Arm the post synchronously. Waiting for its React subscription allowed
      // a quick B → C scroll to happen before B became suspendable.
      if (playbackGeneration > reg.playbackGeneration) {
        reg.playbackGeneration = playbackGeneration;
        reg.cycleUsed = false;
        reg.awaitingReentry = false;
      }
      reg.disableHardSuspend = false;
      syncElementFromLayout(el, reg);
      return;
    }

    // Playback is exclusive: as soon as B is genuinely played, stop A even if
    // an embed's oversized frame still intersects the viewer.
    // Records showed Threads/X players freezing ("stuck, icon only") when a
    // sibling iframe was blanked within ~100ms of the play tap. Pause at once,
    // but defer the src→about:blank swap until the new player has started.
    if (!flagOn('exclusivePause')) return;
    stageAPause(el);
    if (!reg.disableHardSuspend && !reg.cycleUsed) {
      if (reg.state === 'active') reg.state = 'paused';
      setTimeout(() => {
        if (!el.isConnected || activePlaybackPostId !== postId) return;
        if (reg.state === 'active') return;
        putToSleep(el, reg);
      }, DEFERRED_SUSPEND_MS);
    } else if (reg.state === 'active') {
      reg.state = 'paused';
    }
  });
}

const DEFERRED_SUSPEND_MS = 1500;

/**
 * Records: the reload is the only thing that silences X/Threads, but a player
 * reloaded at the moment the user scrolls back freezes/buffers on tap — and a
 * reload firing while the NEWLY tapped video is starting (Threads scroll-down
 * pattern) freezes that new player too. So blank the old one instantly (audio
 * dies), but wait ~5s before reloading it: the newly played video gets a quiet
 * window to start, and the old one is reloaded while still off-screen. If the
 * user scrolls back within the window, reconcileElement's visible path restores
 * it directly, so the delayed reload is skipped. One cycle per play.
 */
function putToSleep(el: HTMLElement, reg: RegisteredElement) {
  hardSuspendIframes(el);
  reg.state = 'suspended';
  reg.awaitingReentry = false;
  reg.cycleUsed = true;
  completedPlaybackCycles.set(reg.postId, reg.playbackGeneration);
}

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
    // Unfreezes/unmutes only. A sleeping embed stays asleep until the user
    // taps its "Tap to load" button.
    stageAResume(el);
  } else if (target === 'paused') {
    stageAPause(el);
  } else if (target === 'suspended') {
    if (reg.disableHardSuspend || reg.cycleUsed) {
      stageAPause(el);
      reg.state = 'paused';
      return;
    }
    if (current === 'active') stageAPause(el);
    putToSleep(el, reg);
    return;
  }

  reg.state = target;
}

function reconcileElement(el: HTMLElement, reg: RegisteredElement) {
  // A visible post must always be tappable. Making it 'active' only
  // unfreezes the frame — it never starts playback or reloads a sleeping
  // embed — so exclusivity is still enforced by onConfirmedPlay.
  if (reg.visible) {
    transitionElement(el, reg, 'active');
    return;
  }

  // Off-screen: never-played posts (and already-slept ones) only get cheap
  // pause commands; a freshly played post is put to sleep once. A sleeping
  // post is never restored in the background.
  if (reg.state !== 'suspended') transitionElement(el, reg, 'suspended');
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
  // Mobile browsers do not reliably fire window.blur again when focus moves
  // directly from iframe A to iframe B. Polling activeElement catches that
  // handoff. Focus cannot move into an iframe from a scroll-only gesture, so
  // this is a direct playback signal rather than another touch heuristic.
  focusedIframePoll = window.setInterval(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLIFrameElement)) {
      lastFocusedIframe = null;
      return;
    }
    if (active === lastFocusedIframe) return;
    lastFocusedIframe = active;
    elementStates.forEach((reg, el) => {
      if (el.contains(active)) {
        onConfirmedPlay(reg.postId, reg.playbackGeneration + 1);
      }
    });
  }, 120);
  // Safety net: IntersectionObserver only fires when a post crosses the whole
  // screen edge, so a playing post that slid under the header — or whose
  // layout shifted inside the grid viewer's own scroll container — could keep
  // playing. On any scroll (captured from every scroll container), re-check
  // only the posts currently 'active'. Usually 0–2 elements → negligible cost.
  document.addEventListener('scroll', onAnyScroll, { capture: true, passive: true });
}

let scrollRaf = 0;
function onAnyScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    elementStates.forEach((reg, el) => {
      if (!el.isConnected) return;
      const rect = el.getBoundingClientRect();
      const inside = isInsideUsableViewport(rect);
      // Re-sync posts whose visibility changed inside the grid viewer's own
      // scroller (IntersectionObserver can miss these), both directions.
      if ((reg.state === 'active') !== inside) syncElementFromLayout(el, reg);
    });
  });
}

function destroySharedObservers() {
  sharedNearObserver?.disconnect();
  sharedActiveObserver?.disconnect();
  if (sharedResizeHandler) window.removeEventListener('resize', sharedResizeHandler);
  document.removeEventListener('scroll', onAnyScroll, { capture: true } as EventListenerOptions);
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
  if (focusedIframePoll) window.clearInterval(focusedIframePoll);
  focusedIframePoll = 0;
  lastFocusedIframe = null;
  activePlaybackPostId = '';
  scrollRaf = 0;
  sharedNearObserver = null;
  sharedActiveObserver = null;
  sharedResizeHandler = null;
}

const replayListeners = new WeakMap<HTMLElement, (event: Event) => void>();
const nativePlayListeners = new WeakMap<HTMLElement, (event: Event) => void>();
const settleListeners = new WeakMap<HTMLElement, (event: Event) => void>();

function registerElement(
  el: HTMLElement,
  disableHardSuspend: boolean,
  postId: string,
  playbackGeneration: number,
) {
  ensureSharedObservers();
  observerRefCount++;

  const reg: RegisteredElement = {
    visible: false,
    prewarm: false,
    state: 'active',
    disableHardSuspend,
    postId,
    playbackGeneration,
    cycleUsed: (completedPlaybackCycles.get(postId) || 0) >= playbackGeneration,
    awaitingReentry: false,
  };
  elementStates.set(el, reg);
  sharedNearObserver!.observe(el);
  sharedActiveObserver!.observe(el);

  const onNativePlay = (event: Event) => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    const current = elementStates.get(el);
    if (!current) return;
    onConfirmedPlay(current.postId, current.playbackGeneration + 1);
  };
  nativePlayListeners.set(el, onNativePlay);
  el.addEventListener('play', onNativePlay, true);

  // NOTE: we deliberately do NOT re-arm the suspend/pre-warm cycle on taps.
  // Any touch that merely starts a scroll over the embed used to count as a
  // "replay intent", which re-armed the cycle and caused repeated iframe
  // reloads for posts the user never actually played. One suspend + pre-warm
  // cycle per post per session is enough to guarantee audio stops.


  // The former one-time off-screen "settle reload" was removed: no embed is
  // ever restarted in the background (sleep-and-stay-asleep model).

  // Sync initial state from layout.
  syncElementFromLayout(el, reg);

}

function updateElementPolicy(
  el: HTMLElement,
  disableHardSuspend: boolean,
  playbackGeneration: number,
) {
  const reg = elementStates.get(el);
  if (!reg) return;
  const newPlayback = playbackGeneration > reg.playbackGeneration;
  reg.disableHardSuspend = disableHardSuspend;
  reg.playbackGeneration = playbackGeneration;
  if (newPlayback) {
    reg.cycleUsed = false;
    reg.awaitingReentry = false;
  }
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
  const onNativePlay = nativePlayListeners.get(el);
  if (onNativePlay) {
    el.removeEventListener('play', onNativePlay, true);
    nativePlayListeners.delete(el);
  }
  const onSettle = settleListeners.get(el);
  if (onSettle) {
    el.removeEventListener('load', onSettle, true);
    settleListeners.delete(el);
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
  postId?: string;
  playbackGeneration?: number;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean,
  options: MediaLifecycleOptions = {}
) {
  const {
    enabled = true,
    disableHardSuspend = false,
    postId = String(observeKey ?? ''),
    playbackGeneration = 0,
  } = options;
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!enabled) {
      restoreHardSuspended(el);
      return;
    }

    registerElement(el, disableHardSuspend, postId, playbackGeneration);
    return () => unregisterElement(el);
  }, [containerRef, observeKey, enabled, postId]);

  // Policy changes after a real play update the existing registration instead
  // of destroying and rebuilding its observer state mid-gesture.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    updateElementPolicy(el, disableHardSuspend, playbackGeneration);
  }, [containerRef, enabled, disableHardSuspend, playbackGeneration]);

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
