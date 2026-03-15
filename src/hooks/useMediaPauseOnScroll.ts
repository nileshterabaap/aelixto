import { useEffect, useRef, useCallback, RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { getMediaCoordinator } from './useMediaCoordinator';

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
  // Native video/audio
  root.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
    if (!el.paused) el.pause();
  });

  // YouTube postMessage
  root.querySelectorAll<HTMLIFrameElement>(YOUTUBE_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } catch { /* cross-origin */ }
  });

  // Spotify postMessage
  root.querySelectorAll<HTMLIFrameElement>(SPOTIFY_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
    } catch { /* cross-origin */ }
  });

  // Freeze other playable iframes (visibility hidden — no reload)
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!isPlayableIframe(iframe)) return;
    if (iframe.matches(API_PAUSABLE_SELECTOR)) return;
    if (iframe.dataset[FROZEN_FLAG] === '1') return;
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
  /** Keep post coordinated even if iframe heuristics miss the platform URL pattern. */
  assumePlayable?: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean,
  options: MediaLifecycleOptions = {}
) {
  const { enabled = true, assumePlayable = false } = options;
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const coordinator = getMediaCoordinator();
    const postId = String(observeKey || el.id || Math.random());

    // Detect playable media now (may update later via MutationObserver)
    let currentPlayable = hasPlayableMedia(el);

    const onActiveChange = (active: boolean) => {
      const currentEl = containerRef.current;
      if (!currentEl) return;
      isActiveRef.current = active;

      if (active) {
        resumeAllMedia(currentEl);
      } else {
        pauseAllMedia(currentEl);
      }
    };

    coordinator.register(postId, el, currentPlayable, onActiveChange);

    // Watch for late-injected media elements (SDK hydration)
    const mutationObserver = new MutationObserver(() => {
      const currentEl = containerRef.current;
      if (!currentEl) return;
      const nowPlayable = hasPlayableMedia(currentEl);
      if (nowPlayable !== currentPlayable) {
        currentPlayable = nowPlayable;
        coordinator.updatePlayableStatus(postId, nowPlayable);
      }
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

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
