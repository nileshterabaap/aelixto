import { useEffect, useRef, RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Pauses all <video> and <audio> elements inside `containerRef` when:
 * 1. The container scrolls out of the viewport (IntersectionObserver)
 * 2. The route changes (user switches nav tab)
 *
 * Media stays paused when scrolled back — user must press play manually.
 */
export function useMediaPauseOnScroll(containerRef: RefObject<HTMLElement | null>) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  // Pause all playing media inside a container (including iframes)
  const pauseAllMedia = (root?: HTMLElement | null) => {
    const target = root || document;
    target.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
      if (!el.paused) {
        el.pause();
      }
    });

    // Pause YouTube iframes via postMessage
    target.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com"]').forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      } catch { /* cross-origin */ }
    });

    // Pause Spotify iframes by replacing src to stop playback
    target.querySelectorAll<HTMLIFrameElement>('iframe[src*="spotify.com"]').forEach((iframe) => {
      try {
        const src = iframe.src;
        if (src && !src.includes('autoplay=false')) {
          // Toggle src to force pause (Spotify has no postMessage API)
          iframe.src = src.replace(/&?autoplay=[^&]*/g, '') + (src.includes('?') ? '&' : '?') + 'autoplay=false';
        }
      } catch { /* cross-origin */ }
    });
  };

  // 1. IntersectionObserver — pause when post leaves viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            pauseAllMedia(entry.target as HTMLElement);
          }
        }
      },
      { threshold: 0.1 } // trigger when <10% visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  // 2. Route change — pause everything in this container
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      pauseAllMedia(containerRef.current);
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
      document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
        if (!el.paused) el.pause();
      });

      // Also pause YouTube iframes by postMessage
      document.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com"]').forEach((iframe) => {
        try {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
        } catch {
          // cross-origin — ignore
        }
      });

      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
