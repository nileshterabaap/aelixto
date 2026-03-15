import { useEffect, RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import {
  observePost,
  unobservePost,
  scanAndRegisterMedia,
  pauseAllMedia,
} from './useMediaCoordinator';

/**
 * Per-post hook: observes the post container for viewport exit (pauses native media)
 * and scans for late-injected media elements via MutationObserver.
 */
export function useMediaPauseOnScroll(
  containerElOrRef: HTMLElement | null | RefObject<HTMLElement | null>,
  _observeKey?: string | number | boolean,
) {
  const element: HTMLElement | null =
    containerElOrRef && 'current' in containerElOrRef
      ? containerElOrRef.current
      : (containerElOrRef as HTMLElement | null);

  useEffect(() => {
    if (!element) return;

    // Observe for viewport exit
    observePost(element);

    // Register any existing native media
    scanAndRegisterMedia(element);

    // Watch for late-injected media (SDK hydration)
    const mo = new MutationObserver(() => {
      scanAndRegisterMedia(element);
    });
    mo.observe(element, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      unobservePost(element);
    };
  }, [element]);
}

/**
 * Mount once at app level to pause all media on route change.
 */
export function useGlobalMediaPauseOnNavigate() {
  const location = useLocation();

  useEffect(() => {
    pauseAllMedia();
  }, [location.pathname]);
}
