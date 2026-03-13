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

  /**
   * Pause all playing media inside a container (native + all iframe platforms).
   * Uses postMessage for YouTube; src-freeze for all others (no pause API).
   */
  const pauseAllMedia = (root?: HTMLElement | null) => {
    const target = root || document;

    // Native <video> and <audio>
    target.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
      if (!el.paused) el.pause();
    });

    // All iframes — platform-specific strategies
    target.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
      const src = iframe.src || '';
      if (!src) return;
      try {
        // YouTube — has postMessage API
        if (src.includes('youtube.com')) {
          iframe.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
          return;
        }

        // For Spotify, TikTok, Facebook, Instagram, Reddit:
        // Freeze the iframe by storing src and blanking it.
        // The src is saved in a data attribute so it can be restored if needed.
        const needsFreeze = [
          'spotify.com', 'tiktok.com',
          'facebook.com', 'instagram.com',
          'reddit.com', 'redd.it'
        ].some(d => src.includes(d));

        if (needsFreeze && !iframe.dataset.frozenSrc) {
          iframe.dataset.frozenSrc = src;
          iframe.src = 'about:blank';
        }
      } catch { /* cross-origin — ignore */ }
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
      // Pause native media
      document.querySelectorAll<HTMLVideoElement | HTMLAudioElement>('video, audio').forEach((el) => {
        if (!el.paused) el.pause();
      });

      // Pause/freeze all platform iframes
      document.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
        const src = iframe.src || '';
        if (!src || src === 'about:blank') return;
        try {
          if (src.includes('youtube.com')) {
            iframe.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
              '*'
            );
            return;
          }
          const needsFreeze = [
            'spotify.com', 'tiktok.com',
            'facebook.com', 'instagram.com',
            'reddit.com', 'redd.it'
          ].some(d => src.includes(d));
          if (needsFreeze && !iframe.dataset.frozenSrc) {
            iframe.dataset.frozenSrc = src;
            iframe.src = 'about:blank';
          }
        } catch { /* cross-origin */ }
      });

      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);
}
