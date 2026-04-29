import { useState, useRef, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80;
const MAX_PULL = 120;

export const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Spinner transforms
  const spinnerOpacity = useTransform(pullY, [0, 40, THRESHOLD], [0, 0.5, 1]);
  const spinnerScale = useTransform(pullY, [0, THRESHOLD], [0.5, 1]);
  const spinnerRotate = useTransform(pullY, [0, MAX_PULL], [0, 360]);

  const isAtTop = useCallback(() => {
    // Check if scrolled to top
    if (containerRef.current) {
      // Walk up to find the scrollable parent
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
        // Rubber-band effect: diminishing returns as you pull further
        const dampened = Math.min(diff * 0.45, MAX_PULL);
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
      // Snap to a loading position
      animate(pullY, 60, { type: "spring", stiffness: 300, damping: 30 });
      setRefreshing(true);

      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(pullY, 0, { type: "spring", stiffness: 300, damping: 30 });
      }
    } else {
      // Snap back
      animate(pullY, 0, { type: "spring", stiffness: 400, damping: 30 });
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
      {/* Pull indicator */}
      <motion.div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-50"
        style={{ top: -40, y: pullY }}
      >
        <motion.div
          className="h-10 w-10 rounded-full bg-background border border-border shadow-lg flex items-center justify-center"
          style={{
            opacity: spinnerOpacity,
            scale: spinnerScale,
          }}
        >
          {refreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <motion.div style={{ rotate: spinnerRotate }}>
              <Loader2 className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Content */}
      <motion.div style={{ y: pullY }}>{children}</motion.div>
    </div>
  );
};
