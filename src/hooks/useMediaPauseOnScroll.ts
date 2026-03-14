import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pauses native <video>/<audio> and YouTube iframes when:
 * 1. The container scrolls out of the viewport (IntersectionObserver + scroll fallback)
 * 2. The route changes (user switches nav tab)
 *
 * IMPORTANT: We intentionally do NOT touch non-YouTube iframe src attributes.
 * SDK-managed embeds (Instagram, Facebook, Threads, TikTok) cannot survive
 * having their src blanked — doing so permanently destroys the embed.
 */

const YOUTUBE_IFRAME_SELECTOR = 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"]';

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
    } catch {
      // cross-origin — ignore
    }
  });
}

function pauseMediaInRoot(root: HTMLElement | Document) {
  pauseNativeMedia(root);
  pauseYouTubeIframes(root);
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
