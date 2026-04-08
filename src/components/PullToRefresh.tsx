import { useState, useRef, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 55;
const MAX_PULL = 100;
const LOADING_REST = 45;

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
    if (containerRef.current) {
      let el: HTMLElement | null = containerRef.current;
      while (el) {
        if (el.scrollTop > 0) return false;
        el = el.parentElement;
      }
    }
    return window.scrollY <= 0;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      // Don't capture pulls originating from the bottom nav area
      const target = e.target as HTMLElement;
      if (target.closest("nav") || target.closest('[aria-label="Create post"]')) return;
      if (isAtTop()) {
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    },
    [refreshing, isAtTop]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (diff > 0 && isAtTop()) {
        // Smooth logarithmic rubber-band — easy to start, harder to pull further
        const dampened = Math.min(MAX_PULL, diff * 0.5 * (1 - diff / (diff + 300)));
        pullY.set(dampened);
      } else {
        pullY.set(0);
      }
    },
    [refreshing, pullY, isAtTop]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    const currentPull = pullY.get();

    if (currentPull >= THRESHOLD && !refreshing) {
      // Snap to loading rest position
      animate(pullY, LOADING_REST, { type: "spring", stiffness: 200, damping: 25 });
      setRefreshing(true);

      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(pullY, 0, { type: "spring", stiffness: 250, damping: 28 });
      }
    } else {
      // Snap back smoothly
      animate(pullY, 0, { type: "spring", stiffness: 350, damping: 28 });
    }
  }, [pullY, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator — overlays on top, content does NOT move */}
      <motion.div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-50"
        style={{ top: -36, y: pullY }}
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

      {/* Content stays in place — no vertical shift */}
      {children}
    </div>
  );
};
