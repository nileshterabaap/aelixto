/**
 * Global iframe touch-freeze during scroll.
 *
 * Problem: Once iframes (YouTube, Instagram, TikTok, etc.) finish loading on
 * mobile, they intercept touch events. The browser must wait for the iframe's
 * touch handler before allowing the native scroll to proceed, causing 1-2s
 * input delay during momentum scrolling.
 *
 * Solution: Set `pointer-events: none` on all feed iframes as soon as a
 * touchmove or scroll starts, then re-enable after scrolling settles.
 * This lets the browser compositor handle scrolling without waiting for
 * iframe touch handlers.
 *
 * Mount this hook once at the app/feed level.
 */

import { useEffect } from 'react';

const SETTLE_MS = 200;

let frozen = false;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function freezeAll() {
  if (frozen) return;
  frozen = true;
  document.documentElement.classList.add('scroll-freezing-iframes');
}

function unfreezeAll() {
  if (!frozen) return;
  frozen = false;
  document.documentElement.classList.remove('scroll-freezing-iframes');
}

function scheduleUnfreeze() {
  if (settleTimer !== null) clearTimeout(settleTimer);
  settleTimer = setTimeout(unfreezeAll, SETTLE_MS);
}

export function useIframeScrollFreeze() {
  useEffect(() => {
    const onTouchMove = () => {
      freezeAll();
      scheduleUnfreeze();
    };

    const onScroll = () => {
      freezeAll();
      scheduleUnfreeze();
    };

    const onTouchEnd = () => {
      // Don't unfreeze immediately — momentum scroll continues after touchend.
      // The scroll handler + settle timer will handle it.
      scheduleUnfreeze();
    };

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchend', onTouchEnd);
      if (settleTimer !== null) clearTimeout(settleTimer);
      unfreezeAll();
    };
  }, []);
}
