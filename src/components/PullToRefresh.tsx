import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 60;
const MAX_PULL = 180;
const LOADING_REST = 55;

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
  const touchStartX = useRef(0);
  const directionLocked = useRef<"none" | "vertical" | "horizontal">("none");
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
      if (!isAtTop()) return;

      const touch = event.touches[0];
      if (!touch) return;

      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      directionLocked.current = "none";
      pulling.current = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!pulling.current || refreshing) return;

      const touch = event.touches[0];
      if (!touch) return;

      const diffY = touch.clientY - touchStartY.current;
      const diffX = touch.clientX - touchStartX.current;

      // Lock direction after small movement; bail on horizontal swipes (e.g. SwipeableView)
      if (directionLocked.current === "none") {
        if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
          directionLocked.current =
            Math.abs(diffX) > Math.abs(diffY) ? "horizontal" : "vertical";
        }
      }

      if (directionLocked.current === "horizontal") {
        pulling.current = false;
        pullY.set(0);
        return;
      }

      const diff = diffY;

      if (diff > 0 && isAtTop()) {
        // 1:1 tracking up to threshold, then gentle resistance for elastic over-pull
        let dampened: number;
        if (diff <= THRESHOLD) {
          dampened = diff;
        } else {
          const over = diff - THRESHOLD;
          dampened = THRESHOLD + over * 0.55 * (1 - over / (over + 400));
        }
        pullY.set(Math.min(MAX_PULL, dampened));
        return;
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
