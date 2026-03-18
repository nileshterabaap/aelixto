import { useEffect, useRef, useState, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

const YOUTUBE_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_SELECTOR = 'iframe[src*="open.spotify.com"]';
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

type LifecycleState = 'active' | 'paused';

interface MediaLifecycleOptions {
  enabled?: boolean;
  hardSuspendDistanceVh?: number;
  disableHardSuspend?: boolean;
}

interface RegistryEntry {
  id: symbol;
  getElement: () => HTMLElement | null;
  setState: (state: LifecycleState) => void;
}

const lifecycleRegistry = new Map<symbol, RegistryEntry>();
let lifecycleFlushRaf: number | null = null;
let listenersAttached = false;
let mutationObserver: MutationObserver | null = null;

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

function pauseNativeMedia(root: ParentNode) {
  root.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
    if (!el.paused) el.pause();
  });
}

function pauseYouTubeIframes(root: ParentNode) {
  root.querySelectorAll<HTMLIFrameElement>(YOUTUBE_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } catch {
      /* cross-origin */
    }
  });
}

function pauseSpotifyIframes(root: ParentNode) {
  root.querySelectorAll<HTMLIFrameElement>(SPOTIFY_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
    } catch {
      /* cross-origin */
    }
  });
}

function pausePlayableMedia(root: ParentNode) {
  pauseNativeMedia(root);
  pauseYouTubeIframes(root);
  pauseSpotifyIframes(root);
}

function isEligibleElement(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (!hasPlayableMedia(el)) return false;

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getDistanceToViewportCenter(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const viewportCenterY = (window.innerHeight || document.documentElement.clientHeight) / 2;
  const elementCenterY = rect.top + rect.height / 2;
  return Math.abs(elementCenterY - viewportCenterY);
}

function flushLifecycleRegistry() {
  lifecycleFlushRaf = null;

  let activeEntryId: symbol | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  lifecycleRegistry.forEach((entry) => {
    const el = entry.getElement();
    if (!el || !isEligibleElement(el)) return;

    const distance = getDistanceToViewportCenter(el);
    if (distance < closestDistance) {
      closestDistance = distance;
      activeEntryId = entry.id;
    }
  });

  lifecycleRegistry.forEach((entry) => {
    const el = entry.getElement();
    if (!el || !isEligibleElement(el)) {
      if (el) pausePlayableMedia(el);
      entry.setState('paused');
      return;
    }

    if (entry.id === activeEntryId) {
      entry.setState('active');
      return;
    }

    pausePlayableMedia(el);
    entry.setState('paused');
  });
}

function scheduleLifecycleFlush() {
  if (lifecycleFlushRaf !== null) return;
  lifecycleFlushRaf = requestAnimationFrame(flushLifecycleRegistry);
}

function handleGlobalViewportChange() {
  scheduleLifecycleFlush();
}

function attachGlobalCoordinator() {
  if (!listenersAttached) {
    listenersAttached = true;
    document.addEventListener('scroll', handleGlobalViewportChange, true);
    window.addEventListener('resize', handleGlobalViewportChange);
  }

  if (!mutationObserver) {
    mutationObserver = new MutationObserver(() => {
      scheduleLifecycleFlush();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'class'],
    });
  }
}

function detachGlobalCoordinator() {
  if (lifecycleRegistry.size > 0) return;

  if (listenersAttached) {
    listenersAttached = false;
    document.removeEventListener('scroll', handleGlobalViewportChange, true);
    window.removeEventListener('resize', handleGlobalViewportChange);
  }

  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
}

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean,
  options: MediaLifecycleOptions = {}
) {
  const enabled = options.enabled ?? true;
  const [lifecycleState, setLifecycleState] = useState<LifecycleState>('paused');
  const stateRef = useRef<LifecycleState>('paused');
  const registryIdRef = useRef(Symbol('media-lifecycle'));

  useEffect(() => {
    const registryId = registryIdRef.current;

    if (!enabled) {
      const el = containerRef.current;
      if (el) pausePlayableMedia(el);

      lifecycleRegistry.delete(registryId);
      detachGlobalCoordinator();
      stateRef.current = 'paused';
      setLifecycleState('paused');
      scheduleLifecycleFlush();
      return;
    }

    lifecycleRegistry.set(registryId, {
      id: registryId,
      getElement: () => containerRef.current,
      setState: (nextState) => {
        if (stateRef.current === nextState) return;
        stateRef.current = nextState;
        setLifecycleState(nextState);
      },
    });

    attachGlobalCoordinator();
    scheduleLifecycleFlush();

    return () => {
      const el = containerRef.current;
      if (el) pausePlayableMedia(el);

      lifecycleRegistry.delete(registryId);
      detachGlobalCoordinator();
      scheduleLifecycleFlush();
    };
  }, [containerRef, observeKey, enabled]);

  return lifecycleState;
}

export function useGlobalMediaPauseOnNavigate() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      pausePlayableMedia(document);
      prevPathRef.current = location.pathname;
      scheduleLifecycleFlush();
    }
  }, [location.pathname]);
}
