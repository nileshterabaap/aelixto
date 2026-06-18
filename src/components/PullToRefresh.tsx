import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const TRIGGER_DISTANCE = 32;
const MAX_DISTANCE = 150;
const REFRESH_RESTING_DISTANCE = 64;
const MIN_REFRESH_MS = 1200;
const PENDING_THRESHOLD = 2;

const shouldIgnorePullTarget = (target: EventTarget | null) => {
  return (
    target instanceof HTMLElement &&
    (target.closest("nav") || target.closest('[aria-label="Create post"]'))
  );
};

export const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const gestureRef = useRef<"idle" | "pending" | "pulling" | "blocked">("idle");
  const refreshingRef = useRef(false);

  const spinnerOpacity = useTransform(pullY, [0, 8, TRIGGER_DISTANCE], [0, 0.7, 1]);
  const spinnerScale = useTransform(pullY, [0, TRIGGER_DISTANCE], [0.65, 1]);
  const spinnerRotate = useTransform(pullY, [0, MAX_DISTANCE], [0, 300]);

  const isAtTop = useCallback(() => {
    const containerScrollTop = containerRef.current?.scrollTop ?? 0;
    const pageScrollTop =
      window.scrollY ||
      document.scrollingElement?.scrollTop ||
      document.documentElement.scrollTop ||
      0;

    return containerScrollTop <= 0 && pageScrollTop <= 0;
  }, []);

  const finishWithoutRefresh = useCallback(() => {
    gestureRef.current = "idle";
    animate(pullY, 0, { type: "spring", stiffness: 90, damping: 24, mass: 1.1 });
  }, [pullY]);

  const runRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    gestureRef.current = "idle";
    setRefreshing(true);
    animate(pullY, REFRESH_RESTING_DISTANCE, { type: "spring", stiffness: 100, damping: 20, mass: 0.9 });

    void (async () => {
      const startedAt = Date.now();
      try {
        await onRefresh();
      } finally {
        const remaining = MIN_REFRESH_MS - (Date.now() - startedAt);
        if (remaining > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, remaining));
        }
        refreshingRef.current = false;
        setRefreshing(false);
        animate(pullY, 0, { type: "spring", stiffness: 90, damping: 24, mass: 1.1 });
      }
    })();
  }, [onRefresh, pullY]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1 || refreshingRef.current) return;
      if (shouldIgnorePullTarget(event.target) || !isAtTop()) return;

      startRef.current = { x: touch.clientX, y: touch.clientY };
      gestureRef.current = "pending";
    };

    const handleMove = (event: TouchEvent) => {
      if (gestureRef.current === "idle" || gestureRef.current === "blocked") return;
      const touch = event.touches[0];
      if (!touch) return;

      const diffX = touch.clientX - startRef.current.x;
      const diffY = touch.clientY - startRef.current.y;

      if (gestureRef.current === "pending") {
        if (Math.abs(diffX) < PENDING_THRESHOLD && Math.abs(diffY) < PENDING_THRESHOLD) return;
        // Block only if the motion is clearly horizontal or clearly upward.
        if (diffY <= 0 || Math.abs(diffX) > diffY * 2.2) {
          gestureRef.current = "blocked";
          return;
        }
        gestureRef.current = "pulling";
      }

      // Cancel only if the user pulled significantly back upward. We don't
      // re-check isAtTop() here because mobile browsers can briefly bump
      // scrollY during the gesture (address bar collapse, layout shift),
      // which would spuriously kill an in-progress pull.
      if (diffY < -24) {
        finishWithoutRefresh();
        return;
      }
      if (diffY <= 0) {
        pullY.set(0);
        return;
      }

      if (event.cancelable) event.preventDefault();
      // Lighter resistance below trigger (1:1) so the spinner follows the
      // finger naturally, gentle resistance after.
      const resisted = diffY <= TRIGGER_DISTANCE
        ? diffY
        : TRIGGER_DISTANCE + (diffY - TRIGGER_DISTANCE) * 0.7;
      pullY.set(Math.min(MAX_DISTANCE, resisted));
    };

    const handleEnd = () => {
      if (gestureRef.current !== "pulling") {
        gestureRef.current = "idle";
        return;
      }

      if (pullY.get() >= TRIGGER_DISTANCE) {
        runRefresh();
      } else {
        finishWithoutRefresh();
      }
    };

    window.addEventListener("touchstart", handleStart, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd, { passive: true });
    window.addEventListener("touchcancel", handleEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [finishWithoutRefresh, isAtTop, pullY, runRefresh]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ overscrollBehaviorY: "contain" }}
    >
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
            <Loader2 className="h-[18px] w-[18px] text-primary animate-spin" />
          ) : (
            <motion.div style={{ rotate: spinnerRotate }}>
              <Loader2 className="h-[18px] w-[18px] text-muted-foreground" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      <motion.div style={{ y: pullY }}>
        {children}
      </motion.div>
    </div>
  );
};
