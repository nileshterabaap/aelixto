import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PostSkeleton } from '@/components/PostSkeleton';
import './HomeOpeningSlot.css';

/** Home-only presentation: players stay mounted and load behind the whole-card placeholder. */
export function HomeOpeningSlot({ children, revealAllowed, onReady }: {
  children: ReactNode;
  revealAllowed: boolean;
  onReady: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const callbackRef = useRef(onReady);
  callbackRef.current = onReady;

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    let settled = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const loadedFrames = new WeakSet<HTMLIFrameElement>();
    const finish = () => {
      if (settled) return;
      settled = true;
      setReady(true);
      callbackRef.current();
    };
    const check = () => {
      if (settled) return;
      const card = root.querySelector('.glass-post-card');
      if (!card) return;
      const media = card.querySelector<HTMLElement>('[style*="contain: layout paint"]');
      const loading = media?.querySelector('[data-embed-status="loading"]');
      const frames = Array.from(media?.querySelectorAll('iframe') ?? []);
      const images = Array.from(card.querySelectorAll('img'));
      const videos = Array.from(media?.querySelectorAll('video') ?? []);
      const framesReady = frames.every(frame => loadedFrames.has(frame));
      const imagesReady = images.every(image => image.complete);
      const videosReady = videos.every(video => video.readyState >= 2 || video.error);
      const hasContent = !media || frames.length > 0 || videos.length > 0 ||
        media.querySelector('img, [data-embed-status="ready"], a[href], [role="button"]');
      if (!loading && hasContent && framesReady && imagesReady && videosReady) {
        // Allow the iframe and the existing inner reveal to paint before crossfading.
        if (!settleTimer) settleTimer = setTimeout(finish, 450);
      } else if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = undefined;
      }
    };
    const onLoad = (event: Event) => {
      if (event.target instanceof HTMLIFrameElement) loadedFrames.add(event.target);
      check();
    };
    root.addEventListener('load', onLoad, true);
    root.addEventListener('error', onLoad, true);
    root.addEventListener('embedReady', check);
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true, attributes: true });
    check();
    // A blocked third-party source must not hold the second slot forever.
    const fallback = setTimeout(finish, 15000);
    return () => {
      settled = true;
      clearTimeout(fallback);
      clearTimeout(settleTimer);
      observer.disconnect();
      root.removeEventListener('load', onLoad, true);
      root.removeEventListener('error', onLoad, true);
      root.removeEventListener('embedReady', check);
    };
  }, []);

  const revealed = ready && revealAllowed;
  return (
    <div className="home-opening-slot" data-revealed={revealed} aria-busy={!revealed}>
      <div ref={contentRef} className="home-opening-content" aria-hidden={!revealed} inert={!revealed ? '' : undefined}>
        {children}
      </div>
      <div className="home-opening-placeholder" aria-hidden><PostSkeleton /></div>
    </div>
  );
}