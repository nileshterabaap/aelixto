import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Loader2 } from "lucide-react";

interface FeedPullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const TRIGGER = 64;
const REST = 52;
const MAX = 140;
const MIN_SPINNER_MS = 500;

const isAtPageTop = () => {
  const y =
    window.scrollY ||
    document.scrollingElement?.scrollTop ||
    document.documentElement.scrollTop ||
    0;
  return y <= 0;
};

const shouldIgnoreTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("nav") ||
      target.closest("input, textarea, select, button[aria-haspopup]") ||
      target.closest('[data-no-pull-refresh="true"]')
  );
};

export const FeedPullToRefresh = ({ onRefresh, children }: FeedPullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const refreshingRef = useRef(false);
  const stateRef = useRef<"idle" | "pending" | "pulling" | "blocked">("idle");
  const startRef = useRef({ x: 0, y: 0 });

  const spinnerOpacity = useTransform(pullY, [0, 20, TRIGGER], [0, 0.7, 1]);
  const spinnerScale = useTransform(pullY, [0, TRIGGER], [0.6, 1]);
  const spinnerRotate = useTransform(pullY, [0, MAX], [0, 320]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reset = () => {
      stateRef.current = "idle";
      animate(pullY, 0, { type: "spring", stiffness: 340, damping: 30 });
    };

    const trigger = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      stateRef.current = "idle";
      animate(pullY, REST, { type: "spring", stiffness: 240, damping: 26 });

      const started = Date.now();
      Promise.resolve()
        .then(() => onRefresh())
        .catch(() => {})
        .finally(async () => {
          const remaining = MIN_SPINNER_MS - (Date.now() - started);
          if (remaining > 0) {
            await new Promise((r) => window.setTimeout(r, remaining));
          }
          refreshingRef.current = false;
          setRefreshing(false);
          animate(pullY, 0, { type: "spring", stiffness: 300, damping: 28 });
        });
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (e.touches.length !== 1) return;
      if (shouldIgnoreTarget(e.target)) return;
      if (!isAtPageTop()) return;
      const t = e.touches[0];
      startRef.current = { x: t.clientX, y: t.clientY };
      stateRef.current = "pending";
    };

    const onMove = (e: TouchEvent) => {
      const s = stateRef.current;
      if (s === "idle" || s === "blocked") return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startRef.current.x;
      const dy = t.clientY - startRef.current.y;

      if (s === "pending") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0) {
          stateRef.current = "blocked";
          return;
        }
        stateRef.current = "pulling";
      }

      if (!isAtPageTop() || dy <= 0) {
        reset();
        return;
      }

      if (e.cancelable) e.preventDefault();
      const resisted = dy <= TRIGGER ? dy : TRIGGER + (dy - TRIGGER) * 0.4;
      pullY.set(Math.min(MAX, resisted));
    };

    const onEnd = () => {
      if (stateRef.current !== "pulling") {
        stateRef.current = "idle";
        return;
      }
      if (pullY.get() >= TRIGGER) trigger();
      else reset();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh, pullY]);

  return (
    <div ref={containerRef} className="relative" style={{ overscrollBehaviorY: "contain" }}>
      <motion.div
        className="pointer-events-none absolute left-0 right-0 z-50 flex justify-center"
        style={{ top: 12, y: pullY }}
      >
        <motion.div
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-md"
          style={{ opacity: spinnerOpacity, scale: spinnerScale }}
        >
          {refreshing ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin text-primary" />
          ) : (
            <motion.div style={{ rotate: spinnerRotate }}>
              <Loader2 className="h-[18px] w-[18px] text-muted-foreground" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      <motion.div style={{ y: pullY }}>{children}</motion.div>
    </div>
  );
};
