import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { getMediaCoordinator } from './useMediaCoordinator';

/**
 * Media lifecycle hook — coordinator-based.
 *
 * One global coordinator determines the single active media post (highest
 * viewport ratio, minimum 50%). Non-active posts are paused immediately.
 *
 * Hard-suspend (about:blank swap) is intentionally removed to avoid reload flicker.
 */

const FROZEN_FLAG = 'aelixFrozen';

const PLAYABLE_IFRAME_HINTS = [
  'youtube.com',
  'youtube-nocookie.com',
  'open.spotify.com/embed',
  'tiktok.com/player',
  'tiktok.com/embed',
  'vm.tiktok.com',
  'instagram.com/reel',
  'instagram.com/reels',
  'facebook.com/plugins/video.php',
  'platform.twitter.com',
  'x.com/i/status',
  'threads.net/embed',
  '/video/',
  '/reel/',
  '/shorts/',
  '/clips/',
];

const PAUSE_MESSAGES: unknown[] = [
  JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), // YouTube
  { command: 'pause' }, // Spotify
  { method: 'pause' }, // Vimeo-style
  { 'x-tiktok-player': true, type: 'pause', value: null }, // TikTok Embed Player
  { type: 'pause' }, // Generic
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

function sendPauseSignals(iframe: HTMLIFrameElement) {
  const win = iframe.contentWindow;
  if (!win) return;

  for (const message of PAUSE_MESSAGES) {
    try {
      win.postMessage(message, '*');
    } catch {
      // cross-origin/no-op
    }
  }
}

function pauseMediaInRoot(root: ParentNode) {
  root.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
    if (!el.paused) el.pause();
  });

  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (!isPlayableIframe(iframe)) return;

    sendPauseSignals(iframe);

    if (iframe.dataset[FROZEN_FLAG] === '1') return;
    iframe.dataset[FROZEN_FLAG] = '1';
    iframe.style.visibility = 'hidden';
    iframe.style.pointerEvents = 'none';
  });
}

function resumeMediaInRoot(root: HTMLElement) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.dataset[FROZEN_FLAG] !== '1') return;
    delete iframe.dataset[FROZEN_FLAG];
    iframe.style.visibility = '';
    iframe.style.pointerEvents = '';
  });
}

interface MediaLifecycleOptions {
  enabled?: boolean;
  assumePlayable?: boolean;
}

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

    let currentPlayable = assumePlayable || hasPlayableMedia(el);

    const onActiveChange = (active: boolean) => {
      const currentEl = containerRef.current;
      if (!currentEl) return;

      if (active) {
        resumeMediaInRoot(currentEl);
      } else {
        pauseMediaInRoot(currentEl);
      }
    };

    coordinator.register(postId, el, currentPlayable, onActiveChange);

    const mutationObserver = new MutationObserver(() => {
      const currentEl = containerRef.current;
      if (!currentEl) return;

      const nowPlayable = assumePlayable || hasPlayableMedia(currentEl);
      if (nowPlayable === currentPlayable) return;

      currentPlayable = nowPlayable;
      coordinator.updatePlayableStatus(postId, nowPlayable);
    });

    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      coordinator.unregister(postId);
    };
  }, [containerRef, observeKey, enabled, assumePlayable]);

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

export function useGlobalMediaPauseOnNavigate() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPathRef.current) return;

    getMediaCoordinator().pauseAll();
    pauseMediaInRoot(document);
    prevPathRef.current = location.pathname;
  }, [location.pathname]);
}
