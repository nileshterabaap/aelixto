import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pauses/suspends media when posts scroll out of the viewport or on route change.
 *
 * Strategy per platform:
 * - Native <video>/<audio>: .pause()
 * - YouTube iframes: postMessage pauseVideo (requires enablejsapi=1)
 * - Spotify iframes: postMessage { command: 'pause' } + hard suspend fallback
 * - Other cross-origin iframes (Instagram, Facebook, Threads, X, TikTok, Pinterest, LinkedIn):
 *   hard suspend by swapping src -> about:blank off-screen, then restore original src on return.
 */

const YOUTUBE_IFRAME_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_IFRAME_SELECTOR = 'iframe[src*="open.spotify.com"]';
const HARD_SUSPEND_EXCLUDED_SELECTORS = YOUTUBE_IFRAME_SELECTOR;

const SUSPENDED_FLAG = 'aelixSuspended';
const SUSPENDED_SRC = 'aelixSuspendedSrc';

function pauseNativeMedia(root: HTMLElement | Document) {
  root.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
    if (!el.paused) el.pause();
  });
}

function pauseYouTubeIframes(root: HTMLElement | Document) {
  root.querySelectorAll<HTMLIFrameElement>(YOUTUBE_IFRAME_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
    } catch { /* cross-origin */ }
  });
}

function pauseSpotifyIframes(root: HTMLElement | Document) {
  root.querySelectorAll<HTMLIFrameElement>(SPOTIFY_IFRAME_SELECTOR).forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage({ command: 'pause' }, '*');
    } catch { /* cross-origin */ }
  });
}

/**
 * Hard suspend cross-origin iframes while off-screen by swapping src to about:blank.
 * This reliably stops playback for platforms without public pause APIs.
 */
function suspendIframe(iframe: HTMLIFrameElement) {
  if (iframe.dataset[SUSPENDED_FLAG] === '1') return;

  const src = iframe.getAttribute('src');
  if (!src || src === 'about:blank') {
    iframe.style.visibility = 'hidden';
    return;
  }

  iframe.dataset[SUSPENDED_SRC] = src;
  iframe.dataset[SUSPENDED_FLAG] = '1';
  iframe.setAttribute('src', 'about:blank');
  iframe.style.visibility = 'hidden';
}

function restoreSuspendedIframe(iframe: HTMLIFrameElement) {
  const shouldRestore = iframe.dataset[SUSPENDED_FLAG] === '1';
  const storedSrc = iframe.dataset[SUSPENDED_SRC];

  if (shouldRestore && storedSrc) {
    iframe.setAttribute('src', storedSrc);
  }

  delete iframe.dataset[SUSPENDED_FLAG];
  delete iframe.dataset[SUSPENDED_SRC];

  if (iframe.style.visibility === 'hidden') {
    iframe.style.visibility = '';
  }
}

function suspendNonYouTubeIframes(root: HTMLElement | Document) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.matches(HARD_SUSPEND_EXCLUDED_SELECTORS)) return;
    suspendIframe(iframe);
  });
}

function restoreSuspendedIframes(root: HTMLElement | Document) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    restoreSuspendedIframe(iframe);
  });
}

function pauseMediaInRoot(root: HTMLElement | Document) {
  pauseNativeMedia(root);
  pauseYouTubeIframes(root);
  pauseSpotifyIframes(root);
  suspendNonYouTubeIframes(root);
}

function resumeMediaInRoot(root: HTMLElement | Document) {
  restoreSuspendedIframes(root);
}

function isElementVisibleInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
}

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean
) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Pause when leaving viewport (IO primary + scroll fallback for stubborn/mobile cases)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    let wasVisible = isElementVisibleInViewport(el);

    const checkVisibility = () => {
      const currentEl = containerRef.current;
      if (!currentEl) return;

      const isVisible = isElementVisibleInViewport(currentEl);
      if (wasVisible && !isVisible) {
        pauseMediaInRoot(currentEl);
      } else if (!wasVisible && isVisible) {
        resumeMediaInRoot(currentEl);
      }
      wasVisible = isVisible;
    };

    const scheduleVisibilityCheck = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        checkVisibility();
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (!entry.isIntersecting || entry.intersectionRatio <= 0) {
            pauseMediaInRoot(target);
            wasVisible = false;
          } else {
            resumeMediaInRoot(target);
            wasVisible = true;
          }
        }
      },
      { threshold: [0, 0.1] }
    );

    observer.observe(el);
    document.addEventListener('scroll', scheduleVisibilityCheck, true);
    window.addEventListener('resize', scheduleVisibilityCheck);
    window.addEventListener('orientationchange', scheduleVisibilityCheck);

    checkVisibility();

    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', scheduleVisibilityCheck, true);
      window.removeEventListener('resize', scheduleVisibilityCheck);
      window.removeEventListener('orientationchange', scheduleVisibilityCheck);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [containerRef, observeKey]);

  // Route change — pause everything in this container
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      const el = containerRef.current;
      if (el) {
        pauseMediaInRoot(el);
      }
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, containerRef]);
}

/**
 * Global route-change media killer.
 * Mount once at app level to pause ALL media on any navigation.
 */
export function useGlobalMediaPauseOnNavigate() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      pauseMediaInRoot(document);
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
