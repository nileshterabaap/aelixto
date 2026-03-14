import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pauses native <video>/<audio> and YouTube iframes when:
 * 1. The container scrolls out of the viewport (IntersectionObserver)
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

export function useMediaPauseOnScroll(
  containerRef: RefObject<HTMLElement | null>,
  observeKey?: string | number | boolean
) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // IntersectionObserver — pause when post leaves viewport.
  // observeKey lets callers re-bind when the observed DOM node appears after hydration.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            pauseNativeMedia(target);
            pauseYouTubeIframes(target);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, observeKey]);

  // Route change — pause everything in this container
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      const el = containerRef.current;
      if (el) {
        pauseNativeMedia(el);
        pauseYouTubeIframes(el);
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
      pauseNativeMedia(document);
      pauseYouTubeIframes(document);
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
