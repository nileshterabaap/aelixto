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
  const instanceId = useRef(Math.random().toString(36).slice(2, 6));

  // Log on mount/unmount
  useEffect(() => {
    const el = containerRef.current;
    console.log(`[MediaPause:${instanceId.current}] MOUNT — ref attached:`, !!el, el?.tagName, el?.className?.slice(0, 60));
    return () => {
      console.log(`[MediaPause:${instanceId.current}] UNMOUNT`);
    };
  }, []);

  // Pause all playing media inside a container
  const pauseAllMedia = (root?: HTMLElement | null, reason?: string) => {
    const target = root || document;
    const videos = target.querySelectorAll<HTMLVideoElement>('video');
    const audios = target.querySelectorAll<HTMLAudioElement>('audio');
    const iframes = target.querySelectorAll<HTMLIFrameElement>('iframe');
    const playingVideos = Array.from(videos).filter(v => !v.paused);
    const playingAudios = Array.from(audios).filter(a => !a.paused);

    console.log(`[MediaPause:${instanceId.current}] pauseAllMedia (${reason}) — ` +
      `videos: ${videos.length} (playing: ${playingVideos.length}), ` +
      `audios: ${audios.length} (playing: ${playingAudios.length}), ` +
      `iframes: ${iframes.length}`);

    if (iframes.length > 0) {
      iframes.forEach((iframe, i) => {
        console.log(`[MediaPause:${instanceId.current}]   iframe[${i}] src: ${iframe.src?.slice(0, 80)}`);
      });
    }

    videos.forEach((el) => {
      if (!el.paused) {
        console.log(`[MediaPause:${instanceId.current}]   pausing video src: ${el.src?.slice(0, 80) || el.currentSrc?.slice(0, 80)}`);
        el.pause();
      }
    });
    audios.forEach((el) => {
      if (!el.paused) {
        console.log(`[MediaPause:${instanceId.current}]   pausing audio`);
        el.pause();
      }
    });
  };

  // 1. IntersectionObserver — pause when post leaves viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      console.warn(`[MediaPause:${instanceId.current}] IO skipped — ref is NULL`);
      return;
    }

    console.log(`[MediaPause:${instanceId.current}] IO attached to`, el.tagName, el.className?.slice(0, 60));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            console.log(`[MediaPause:${instanceId.current}] IO: LEFT viewport (ratio: ${entry.intersectionRatio.toFixed(3)})`);
            pauseAllMedia(entry.target as HTMLElement, 'IO-left-viewport');
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  // 2. Route change — pause everything in this container
  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      console.log(`[MediaPause:${instanceId.current}] Route changed: ${prevPathRef.current} → ${location.pathname}`);
      pauseAllMedia(containerRef.current, 'route-change');
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
