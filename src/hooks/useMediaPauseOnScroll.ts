import { useEffect, useRef, useCallback, RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { getMediaCoordinator } from './useMediaCoordinator';

console.log('[MediaLifecycle] module loaded');

/**
 * Media lifecycle hook — v2 (coordinator-based).
 *
 * Registers the post container with a global MediaCoordinator that uses
 * a single IntersectionObserver across all posts. Only one post is "active"
 * at a time (the one with the highest viewport visibility).
 *
 * When a post becomes inactive:
 *   – Native <video>/<audio> are paused.
 *   – YouTube iframes receive a postMessage "pauseVideo".
 *   – Spotify iframes receive a postMessage { command: 'pause' }.
 *   – Other playable iframes get visibility:hidden (no src change, no reload).
 *
 * Hard-suspend (about:blank swap) has been removed entirely to prevent
 * embed reload flicker.
 */

// ── Selectors ──────────────────────────────────────────────────────────

const YOUTUBE_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_SELECTOR = 'iframe[src*="open.spotify.com"]';
const API_PAUSABLE_SELECTOR = [YOUTUBE_SELECTOR, SPOTIFY_SELECTOR].join(', ');

const FROZEN_FLAG = 'aelixFrozen';

// ── Playable media detection ───────────────────────────────────────────

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
  if (root.querySelector('video, audio')) return true;
  return Array.from(root.querySelectorAll<HTMLIFrameElement>('iframe')).some(isPlayableIframe);
}

// ── Pause / Resume helpers ─────────────────────────────────────────────

function pauseAllMedia(root: HTMLElement) {
  const videos = root.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio');
  const ytIframes = root.querySelectorAll<HTMLIFrameElement>(YOUTUBE_SELECTOR);
  const spotifyIframes = root.querySelectorAll<HTMLIFrameElement>(SPOTIFY_SELECTOR);
  const allIframes = root.querySelectorAll<HTMLIFrameElement>('iframe');

  console.log(`[MediaPause] pauseAllMedia: videos=${videos.length} yt=${ytIframes.length} spotify=${spotifyIframes.length} iframes=${allIframes.length}`);
  allIframes.forEach(f => console.log(`[MediaPause]   iframe src=${f.src?.slice(0,80)}`));

  videos.forEach((el) => {
    if (!el.paused) {
      console.log(`[MediaPause] .pause() on <${el.tagName}>`);
      el.pause();
    }
  });

  ytIframes.forEach((iframe) => {
    try {
      console.log(`[MediaPause] postMessage pauseVideo → YouTube`);
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } catch { /* cross-origin */ }
  });

  spotifyIframes.forEach((iframe) => {
    try {
      console.log(`[MediaPause] postMessage pause → Spotify`);
      iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
    } catch { /* cross-origin */ }
  });

  allIframes.forEach((iframe) => {
    if (!isPlayableIframe(iframe)) return;
    if (iframe.matches(API_PAUSABLE_SELECTOR)) return;
    if (iframe.dataset[FROZEN_FLAG] === '1') return;
    console.log(`[MediaPause] FREEZE iframe src=${iframe.src?.slice(0,60)}`);
    iframe.dataset[FROZEN_FLAG] = '1';
    iframe.style.visibility = 'hidden';
  });
}

function resumeAllMedia(root: HTMLElement) {
  // Unfreeze iframes
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[FROZEN_FLAG] !== '1') return;
    delete iframe.dataset[FROZEN_FLAG];
    iframe.style.visibility = '';
  });
}

// ── Hook options ───────────────────────────────────────────────────────

interface MediaLifecycleOptions {
  /** Enable lifecycle for this post. Should be true only for playable media posts. */
  enabled?: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useMediaPauseOnScroll(
  containerElOrRef: HTMLElement | null | RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean,
  options: MediaLifecycleOptions = {}
) {
  // Accept either a direct element or a ref object
  const element = containerElOrRef && 'current' in containerElOrRef
    ? containerElOrRef.current
    : containerElOrRef;

  const { enabled = true } = options;
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!element || !enabled) {
      console.log(`[MediaLifecycle] hook SKIP: el=${!!element} enabled=${enabled} key=${observeKey}`);
      return;
    }

    const coordinator = getMediaCoordinator();
    const postId = String(observeKey || element.id || Math.random());

    let currentPlayable = hasPlayableMedia(el);
    console.log(`[MediaLifecycle] hook mounted`, observeKey, `playable=${currentPlayable}`);

    const onActiveChange = (active: boolean) => {
      const currentEl = containerRef.current;
      if (!currentEl) return;
      isActiveRef.current = active;
      console.log(`[MediaHook] onActiveChange postId=${postId.slice(0,30)} active=${active}`);

      if (active) {
        resumeAllMedia(currentEl);
      } else {
        pauseAllMedia(currentEl);
      }
    };

    coordinator.register(postId, el, currentPlayable, onActiveChange);

    // Watch for late-injected media elements (SDK hydration)
    // childList+subtree: catches new elements added by SDKs
    // attributes on iframes: catches src being set after insertion
    const mutationObserver = new MutationObserver(() => {
      const currentEl = containerRef.current;
      if (!currentEl) return;
      const nowPlayable = hasPlayableMedia(currentEl);
      if (nowPlayable !== currentPlayable) {
        console.log(`[MediaHook] PLAYABLE STATUS CHANGED postId=${postId.slice(0,30)} ${currentPlayable} → ${nowPlayable}`);
        currentPlayable = nowPlayable;
        coordinator.updatePlayableStatus(postId, nowPlayable);
      }
    });
    mutationObserver.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'allow'],
    });

    return () => {
      mutationObserver.disconnect();
      coordinator.unregister(postId);
    };
  }, [containerRef, observeKey, enabled]);

  // Route change — pause media via coordinator
  useEffect(() => {
    if (!enabled) {
      prevPathRef.current = location.pathname;
      return;
    }

    if (location.pathname !== prevPathRef.current) {
      getMediaCoordinator().pauseAll();
      prevPathRef.current = location.pathname;
    }
  }, [enabled, location.pathname]);
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
      getMediaCoordinator().pauseAll();

      // Also directly pause any native media (in case not registered)
      document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
        if (!el.paused) el.pause();
      });
      // YouTube
      document.querySelectorAll<HTMLIFrameElement>(YOUTUBE_SELECTOR).forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
        } catch { /* cross-origin */ }
      });
      // Spotify
      document.querySelectorAll<HTMLIFrameElement>(SPOTIFY_SELECTOR).forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
        } catch { /* cross-origin */ }
      });

      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
