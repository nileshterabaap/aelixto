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
// Never let the spinner hang: if a refresh takes longer than this, we release
// the indicator and let the data land whenever it lands.
const MAX_SPINNER_MS = 5000;

// Allows other UI (e.g. tapping the Home tab while already at the top of the
// feed) to trigger the same refresh + spinner as a manual pull.
export const FEED_REFRESH_EVENT = "aelixto:feed-refresh";
export const triggerFeedRefresh = () => {
  window.dispatchEvent(new CustomEvent(FEED_REFRESH_EVENT));
};

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

    // Toggle `body.at-scroll-top` so iframes become pointer-events:none
    // when at the top of the page — this is what lets the finger start
    // a pull gesture over a YouTube/Instagram/Twitter embed. As soon as
    // the user scrolls down, iframes become interactive again.
    const updateAtTop = () => {
      const pageScrollTop =
        window.scrollY ||
        document.scrollingElement?.scrollTop ||
        document.documentElement.scrollTop ||
        0;
      const atTop = pageScrollTop <= 2;
      document.body.classList.toggle("at-scroll-top", atTop);
    };
    updateAtTop();
    window.addEventListener("scroll", updateAtTop, { passive: true });

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
            await Promise.race([
              Promise.resolve(onRefresh()).catch(() => undefined),
              new Promise((resolve) => setTimeout(resolve, MAX_SPINNER_MS)),
            ]);
          } finally {
            setRefreshing(false);
            animate(pullY, 0, { type: "spring", stiffness: 250, damping: 28 });
          }
        })();

        return;
      }

      animate(pullY, 0, { type: "spring", stiffness: 350, damping: 28 });
    };

    // Listen on window (capture phase) so touches over iframes, overlays,
    // and embeds still trigger PTR — matching Instagram's "pull from anywhere".
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("touchstart", handleTouchStart, opts);
    window.addEventListener("touchmove", handleTouchMove, opts);
    window.addEventListener("touchend", handleTouchEnd, opts);
    window.addEventListener("touchcancel", handleTouchEnd, opts);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart, opts);
      window.removeEventListener("touchmove", handleTouchMove, opts);
      window.removeEventListener("touchend", handleTouchEnd, opts);
      window.removeEventListener("touchcancel", handleTouchEnd, opts);
      window.removeEventListener("scroll", updateAtTop);
      document.body.classList.remove("at-scroll-top");
    };
  }, [isAtTop, onRefresh, pullY, refreshing]);

  // Programmatic refresh (Home tab tap at top of feed)
  useEffect(() => {
    const handleExternalRefresh = () => {
      if (refreshing) return;
      animate(pullY, LOADING_REST, { type: "spring", stiffness: 200, damping: 25 });
      setRefreshing(true);
      void (async () => {
        try {
          await Promise.race([
            Promise.resolve(onRefresh()).catch(() => undefined),
            new Promise((resolve) => setTimeout(resolve, MAX_SPINNER_MS)),
          ]);
        } finally {
          setRefreshing(false);
          animate(pullY, 0, { type: "spring", stiffness: 250, damping: 28 });
        }
      })();
    };
    window.addEventListener(FEED_REFRESH_EVENT, handleExternalRefresh);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, handleExternalRefresh);
  }, [onRefresh, pullY, refreshing]);

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
