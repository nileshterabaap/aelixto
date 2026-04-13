import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Detects horizontal edge swipes on the home screen:
 * - Swipe from left edge → /saved
 * - Swipe from right edge → /messages
 *
 * Only active when on "/" route. Uses touch events with passive listeners.
 */

const EDGE_ZONE = 30; // px from screen edge to start tracking
const MIN_SWIPE_DISTANCE = 80; // px horizontal travel to trigger
const MAX_VERTICAL_DRIFT = 60; // px vertical drift allowed

export function useSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const touchRef = useRef<{
    startX: number;
    startY: number;
    edge: 'left' | 'right' | null;
  } | null>(null);

  useEffect(() => {
    if (location.pathname !== '/') return;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const vw = window.innerWidth;
      const edge =
        touch.clientX < EDGE_ZONE ? 'left' :
        touch.clientX > vw - EDGE_ZONE ? 'right' :
        null;
      if (!edge) { touchRef.current = null; return; }
      touchRef.current = { startX: touch.clientX, startY: touch.clientY, edge };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const ref = touchRef.current;
      if (!ref || !ref.edge) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - ref.startX;
      const dy = Math.abs(touch.clientY - ref.startY);
      touchRef.current = null;

      if (dy > MAX_VERTICAL_DRIFT) return;

      if (ref.edge === 'left' && dx > MIN_SWIPE_DISTANCE) {
        navigate('/saved');
      } else if (ref.edge === 'right' && dx < -MIN_SWIPE_DISTANCE) {
        navigate('/messages');
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [location.pathname, navigate]);
}
