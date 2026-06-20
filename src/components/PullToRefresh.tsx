import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { flushSync } from "react-dom";
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
const PENDING_THRESHOLD = 4;

const shouldIgnorePullTarget = (target: EventTarget | null) => {
  return (
    target instanceof HTMLElement &&
    (target.closest("nav") || target.closest('[aria-label="Create post"]'))
  );
};

export const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const gestureRef = useRef<"idle" | "pending" | "pulling" | "blocked">("idle");
  const refreshingRef = useRef(false);

  const spinnerOpacity = useTransform(pullY, [0, 8, TRIGGER_DISTANCE], [0, 0.7, 1]);
  const spinnerScale = useTransform(pullY, [0, TRIGGER_DISTANCE], [0.65, 1]);
  const spinnerRotate = useTransform(pullY, [0, MAX_DISTANCE], [0, 300]);

  const isAtTop = useCallback(() => {
    const pageScrollTop =
      window.scrollY ||
      document.scrollingElement?.scrollTop ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    return pageScrollTop <= 1;
  }, []);

  const finishWithoutRefresh = useCallback(() => {
    gestureRef.current = "idle";
    (window as unknown as { __pullActive?: boolean }).__pullActive = false;
    animate(pullY, 0, { type: "spring", stiffness: 90, damping: 24, mass: 1.1 });
  }, [pullY]);

  const runRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    gestureRef.current = "idle";
    (window as unknown as { __pullActive?: boolean }).__pullActive = false;
    flushSync(() => {
      setRefreshing(true);
    });
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
    const el = wrapperRef.current;
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
        // Block if the motion is upward or more horizontal than vertical.
        if (diffY <= 0 || Math.abs(diffX) > diffY) {
          gestureRef.current = "blocked";
          return;
        }
        gestureRef.current = "pulling";
        // Tell SwipeableView (and anyone else) to stand down for this gesture.
        (window as unknown as { __pullActive?: boolean }).__pullActive = true;
      }

      // Once locked into a pull, we own this gesture until touchend.
      // We never recheck scroll position or cancel mid-gesture — only
      // clamp the visual offset so the spinner can't go above its rest.
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
        (window as unknown as { __pullActive?: boolean }).__pullActive = false;
        return;
      }

      if (pullY.get() >= TRIGGER_DISTANCE) {
        runRefresh();
      } else {
        finishWithoutRefresh();
      }
    };

    // Listen on our own subtree so we don't fight other global handlers,
    // but use capture so SwipeableView (which listens on its own container)
    // still cooperates via the __pullActive flag.
    el.addEventListener("touchstart", handleStart, { passive: true });
    el.addEventListener("touchmove", handleMove, { passive: false });
    el.addEventListener("touchend", handleEnd, { passive: true });
    el.addEventListener("touchcancel", handleEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchmove", handleMove);
      el.removeEventListener("touchend", handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
      (window as unknown as { __pullActive?: boolean }).__pullActive = false;
    };
  }, [finishWithoutRefresh, isAtTop, pullY, runRefresh]);

  return (
    <div
      ref={wrapperRef}
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

      {/* Content stays static — only the spinner translates. This removes
          the layout shift that was making mobile browsers cancel the
          gesture and snap the spinner back. */}
      <div>{children}</div>
    </div>
  );
};
