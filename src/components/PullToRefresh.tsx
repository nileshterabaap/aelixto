import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 55;
const MAX_PULL = 100;
const LOADING_REST = 45;

const shouldIgnorePullTarget = (target: EventTarget | null) => {
  return (
    target instanceof HTMLElement &&
    (target.closest("nav") || target.closest('[aria-label="Create post"]'))
  );
};

export const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Spinner transforms — fade in quickly, scale smoothly
  const spinnerOpacity = useTransform(pullY, [0, 20, THRESHOLD], [0, 0.6, 1]);
  const spinnerScale = useTransform(pullY, [0, THRESHOLD], [0.4, 1]);
  const spinnerRotate = useTransform(pullY, [0, MAX_PULL], [0, 270]);

  const isAtTop = useCallback(() => {
    const containerScrollTop = containerRef.current?.scrollTop ?? 0;
    const pageScrollTop =
      window.scrollY ||
      document.scrollingElement?.scrollTop ||
      document.documentElement.scrollTop ||
      0;

    return containerScrollTop <= 0 && pageScrollTop <= 0;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (refreshing) return;
      if (shouldIgnorePullTarget(event.target)) return;
      const touch = event.touches[0];
      if (!touch) return;

      touchStartY.current = touch.clientY;
      // Allow starting the gesture from any scroll position.
      // We'll begin the actual pull only once the user reaches the top
      // while still dragging downward (Instagram-style).
      pulling.current = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!pulling.current || refreshing) return;

      const touch = event.touches[0];
      if (!touch) return;

      const diff = touch.clientY - touchStartY.current;

      if (diff > 0 && isAtTop()) {
        // Re-anchor the start position the moment we hit the top, so the
        // pull distance is measured from "top reached", not from finger-down.
        const anchored = touch.clientY - touchStartY.current;
        const dampened = Math.min(MAX_PULL, anchored * 0.5 * (1 - anchored / (anchored + 300)));
        pullY.set(dampened);
        return;
      }

      if (!isAtTop()) {
        // User is still scrolling normally — re-anchor so when they hit the
        // top mid-gesture the pull starts cleanly from 0.
        touchStartY.current = touch.clientY;
      }
      pullY.set(0);
    };

    const handleTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;

      const currentPull = pullY.get();

      if (currentPull >= THRESHOLD && !refreshing) {
        animate(pullY, LOADING_REST, { type: "spring", stiffness: 200, damping: 25 });
        setRefreshing(true);

        void (async () => {
          try {
            await onRefresh();
          } finally {
            setRefreshing(false);
            animate(pullY, 0, { type: "spring", stiffness: 250, damping: 28 });
          }
        })();

        return;
      }

      animate(pullY, 0, { type: "spring", stiffness: 350, damping: 28 });
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isAtTop, onRefresh, pullY, refreshing]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ touchAction: "pan-y" }}
    >
      {/* Pull indicator — overlays on top, content does NOT move */}
      <motion.div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-50"
        style={{ top: 12, y: pullY, x: 0 }}
      >
        <motion.div
          className="h-9 w-9 rounded-full bg-background border border-border shadow-md flex items-center justify-center"
          style={{
            opacity: spinnerOpacity,
            scale: spinnerScale,
          }}
        >
          {refreshing ? (
            <Loader2 className="h-4.5 w-4.5 text-primary animate-spin" />
          ) : (
            <motion.div style={{ rotate: spinnerRotate }}>
              <Loader2 className="h-4.5 w-4.5 text-muted-foreground" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Content drags down with the pull, Instagram-style */}
      <motion.div style={{ y: pullY }}>
        {children}
      </motion.div>
    </div>
  );
};
