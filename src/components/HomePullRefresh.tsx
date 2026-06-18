import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface HomePullRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  /** Disable gesture entirely (e.g. while loading skeleton) */
  disabled?: boolean;
}

const TRIGGER_DISTANCE = 70; // px pulled to trigger refresh
const MAX_PULL = 110; // px max visual offset
const RESISTANCE = 0.5; // dampen finger travel
const HORIZONTAL_LOCK = 10; // px horizontal movement that cancels pull
const EDGE_IGNORE = 30; // px from horizontal edges where SwipeableView owns the gesture

/**
 * Home-only pull-to-refresh. Triggers exclusively when:
 * - page scroll is at the very top,
 * - touch starts away from horizontal edges (so SwipeableView can take side swipes),
 * - finger moves downward more than sideways.
 *
 * The wrapped subtree physically follows the finger for tactile feedback.
 */
export const HomePullRefresh = ({ children, onRefresh, disabled }: HomePullRefreshProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const tracking = useRef(false);
  const locked = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const reset = useCallback((animate = true) => {
    tracking.current = false;
    locked.current = false;
    setOffset(0);
    if (!animate) return;
  }, []);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || refreshing) return;
      if (window.scrollY > 0) return;
      const t = e.touches[0];
      const w = window.innerWidth;
      if (t.clientX < EDGE_IGNORE || t.clientX > w - EDGE_IGNORE) return;
      tracking.current = true;
      locked.current = false;
      startY.current = t.clientY;
      startX.current = t.clientX;
    },
    [disabled, refreshing]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!tracking.current) return;
      const t = e.touches[0];
      const dy = t.clientY - startY.current;
      const dx = t.clientX - startX.current;

      if (!locked.current) {
        if (Math.abs(dx) > HORIZONTAL_LOCK && Math.abs(dx) > Math.abs(dy)) {
          // horizontal gesture → bail out, let SwipeableView/nothing handle it
          tracking.current = false;
          return;
        }
        if (dy > 6) {
          locked.current = true;
        } else {
          return;
        }
      }

      if (dy <= 0 || window.scrollY > 0) {
        setOffset(0);
        return;
      }

      const pulled = Math.min(MAX_PULL, dy * RESISTANCE);
      setOffset(pulled);
    },
    []
  );

  const onTouchEnd = useCallback(async () => {
    if (!tracking.current && offset === 0) return;
    const shouldFire = locked.current && offset >= TRIGGER_DISTANCE && !refreshing;
    tracking.current = false;
    locked.current = false;

    if (!shouldFire) {
      setOffset(0);
      return;
    }

    setRefreshing(true);
    setOffset(56); // park the spinner while refreshing
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setOffset(0);
    }
  }, [offset, refreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // passive listeners — we never need preventDefault because the page
    // is at scroll top and we only translate our own element.
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const indicatorOpacity = Math.min(1, offset / TRIGGER_DISTANCE);
  const indicatorRotate = (offset / TRIGGER_DISTANCE) * 180;
  const isAnimating = !tracking.current;

  return (
    <div ref={containerRef} className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
        style={{
          transform: `translateY(${Math.max(0, offset - 32)}px)`,
          opacity: indicatorOpacity,
          transition: isAnimating ? "transform 200ms ease, opacity 200ms ease" : "none",
        }}
      >
        <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-md border border-border">
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Loader2
              className="h-4 w-4 text-primary"
              style={{ transform: `rotate(${indicatorRotate}deg)`, transition: isAnimating ? "transform 200ms ease" : "none" }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${offset}px)`,
          transition: isAnimating ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
};