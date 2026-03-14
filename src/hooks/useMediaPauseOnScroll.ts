import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pauses/freezes media when posts scroll out of the viewport or on route change.
 *
 * Strategy per platform:
 * - Native <video>/<audio>: .pause()
 * - YouTube iframes: postMessage pauseVideo (requires enablejsapi=1)
 * - Spotify iframes: postMessage { command: 'pause' }
 * - All other iframes (Instagram, Facebook, Threads, X, TikTok, Pinterest, LinkedIn):
 *   Set visibility:hidden to suspend rendering. Most browsers stop media playback
 *   when an iframe is invisible. Restored when the post re-enters the viewport.
 *
 * IMPORTANT: We never blank iframe src — SDK embeds cannot survive that.
 */

const YOUTUBE_IFRAME_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';
const SPOTIFY_IFRAME_SELECTOR = 'iframe[src*="open.spotify.com"]';

// Iframes we handle via postMessage — excluded from the generic freeze
const API_CONTROLLED_SELECTORS = [YOUTUBE_IFRAME_SELECTOR, SPOTIFY_IFRAME_SELECTOR].join(', ');

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
 * For cross-origin iframes without a pause API (Instagram, Facebook, Threads,
 * X/Twitter, TikTok, Pinterest, LinkedIn), hide them to suspend browser rendering.
 */
function freezeGenericIframes(root: HTMLElement | Document) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.matches(API_CONTROLLED_SELECTORS)) return;
    iframe.style.visibility = 'hidden';
  });
}

function unfreezeGenericIframes(root: HTMLElement | Document) {
  root.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
    if (iframe.matches(API_CONTROLLED_SELECTORS)) return;
    if (iframe.style.visibility === 'hidden') {
      iframe.style.visibility = '';
    }
  });
}

function pauseMediaInRoot(root: HTMLElement | Document) {
  pauseNativeMedia(root);
  pauseYouTubeIframes(root);
  pauseSpotifyIframes(root);
  freezeGenericIframes(root);
}

function resumeMediaInRoot(root: HTMLElement | Document) {
  unfreezeGenericIframes(root);
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
