import { useRef, useEffect, useCallback, useState, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface SwipeableViewProps {
  children: ReactNode;
  /** Route to navigate when swiping right (revealing left page) */
  leftRoute?: string;
  /** Route to navigate when swiping left (revealing right page) */
  rightRoute?: string;
  /** Label shown on the left edge during swipe */
  leftLabel?: string;
  /** Label shown on the right edge during swipe */
  rightLabel?: string;
}

const EDGE_ZONE = 30; // px from screen edge to start tracking
const SWIPE_THRESHOLD = 0.25; // 25% of screen width to commit
const VELOCITY_THRESHOLD = 0.4; // px/ms velocity to commit regardless of distance
const SPRING_DURATION = 280; // ms for spring-back animation

/**
 * Wraps a page and enables Instagram-style horizontal swipe navigation.
 * The page physically follows the finger during swipe. On release:
 * - Past threshold or fast velocity → navigate to adjacent page
 * - Otherwise → spring back
 */
export const SwipeableView = ({
  children,
  leftRoute,
  rightRoute,
  leftLabel,
  rightLabel,
}: SwipeableViewProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Gesture state stored in ref for perf (no re-renders during gesture)
  const gesture = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTime: number;
    currentX: number;
    direction: "left" | "right" | null;
    locked: boolean; // true once we've determined horizontal vs vertical
    isVertical: boolean;
  } | null>(null);

  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeDirection, setActiveDirection] = useState<"left" | "right" | null>(null);
  const rafRef = useRef<number>(0);

  const vw = useRef(window.innerWidth);
  useEffect(() => {
    const onResize = () => { vw.current = window.innerWidth; };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const resetGesture = useCallback(() => {
    gesture.current = null;
    setActiveDirection(null);
    setTranslateX(0);
    setIsAnimating(false);
  }, []);

  const commitNavigation = useCallback(
    (direction: "left" | "right") => {
      const target = direction === "right" ? leftRoute : rightRoute;
      if (!target) return;

      // Animate off-screen
      setIsAnimating(true);
      const targetX = direction === "right" ? vw.current : -vw.current;
      setTranslateX(targetX);

      // Navigate after animation completes
      setTimeout(() => {
        navigate(target);
        resetGesture();
      }, SPRING_DURATION);
    },
    [leftRoute, rightRoute, navigate, resetGesture]
  );

  const springBack = useCallback(() => {
    setIsAnimating(true);
    setTranslateX(0);
    setTimeout(resetGesture, SPRING_DURATION);
  }, [resetGesture]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isAnimating) return;
      const touch = e.touches[0];
      if (!touch) return;

      const x = touch.clientX;
      const width = vw.current;

      // Only start tracking from edges, or anywhere if both routes exist
      const fromLeftEdge = x < EDGE_ZONE && leftRoute;
      const fromRightEdge = x > width - EDGE_ZONE && rightRoute;

      if (!fromLeftEdge && !fromRightEdge) return;

      gesture.current = {
        active: true,
        startX: x,
        startY: touch.clientY,
        startTime: Date.now(),
        currentX: x,
        direction: null,
        locked: false,
        isVertical: false,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g || !g.active) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;

      // Lock direction after 10px of movement
      if (!g.locked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        g.locked = true;
        g.isVertical = Math.abs(dy) > Math.abs(dx);
        if (g.isVertical) {
          gesture.current = null;
          return;
        }
        // Determine swipe direction
        g.direction = dx > 0 ? "right" : "left";
        
        // Validate direction has a target
        if (g.direction === "right" && !leftRoute) {
          gesture.current = null;
          return;
        }
        if (g.direction === "left" && !rightRoute) {
          gesture.current = null;
          return;
        }
        
        setActiveDirection(g.direction);
      }

      if (!g.locked || g.isVertical) return;

      // Clamp: only allow movement in the initial direction
      let clampedDx = dx;
      if (g.direction === "right") {
        clampedDx = Math.max(0, dx);
      } else {
        clampedDx = Math.min(0, dx);
      }

      // Apply rubber-band resistance
      const ratio = Math.abs(clampedDx) / vw.current;
      const dampened = clampedDx * (1 - ratio * 0.3);

      g.currentX = touch.clientX;

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setTranslateX(dampened);
      });
    };

    const onTouchEnd = () => {
      const g = gesture.current;
      if (!g || !g.active || !g.locked || g.isVertical) {
        gesture.current = null;
        setActiveDirection(null);
        return;
      }

      const dx = g.currentX - g.startX;
      const elapsed = Date.now() - g.startTime;
      const velocity = Math.abs(dx) / elapsed; // px/ms
      const ratio = Math.abs(dx) / vw.current;

      if (
        (ratio > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) &&
        g.direction
      ) {
        commitNavigation(g.direction);
      } else {
        springBack();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isAnimating, leftRoute, rightRoute, commitNavigation, springBack]);

  const progress = Math.abs(translateX) / vw.current;
  const showLeftShadow = activeDirection === "right" && translateX > 0;
  const showRightShadow = activeDirection === "left" && translateX < 0;

  return (
    <div ref={containerRef} className="relative screen overflow-x-hidden">
      {/* Left edge shadow + label (swiping right to reveal Saved) */}
      {showLeftShadow && (
        <div
          className="fixed inset-y-0 left-0 z-[60] pointer-events-none flex items-center"
          style={{ width: Math.max(translateX, 0) }}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent"
            style={{ opacity: Math.min(progress * 2, 0.8) }}
          />
          {leftLabel && progress > 0.08 && (
            <span
              className="relative z-10 ml-4 text-sm font-medium text-foreground/70 select-none"
              style={{ opacity: Math.min((progress - 0.08) * 5, 1) }}
            >
              {leftLabel}
            </span>
          )}
          {/* Edge line indicator */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-16 rounded-full bg-foreground/20"
            style={{ opacity: Math.min(progress * 3, 0.6) }}
          />
        </div>
      )}

      {/* Right edge shadow + label (swiping left to reveal Messages) */}
      {showRightShadow && (
        <div
          className="fixed inset-y-0 right-0 z-[60] pointer-events-none flex items-center justify-end"
          style={{ width: Math.max(-translateX, 0) }}
        >
          <div
            className="absolute inset-0 bg-gradient-to-l from-background/80 to-transparent"
            style={{ opacity: Math.min(progress * 2, 0.8) }}
          />
          {rightLabel && progress > 0.08 && (
            <span
              className="relative z-10 mr-4 text-sm font-medium text-foreground/70 select-none"
              style={{ opacity: Math.min((progress - 0.08) * 5, 1) }}
            >
              {rightLabel}
            </span>
          )}
          {/* Edge line indicator */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 rounded-full bg-foreground/20"
            style={{ opacity: Math.min(progress * 3, 0.6) }}
          />
        </div>
      )}

      {/* Main content with transform */}
      <div
        className="screen"
        style={{
          transform: translateX !== 0 ? `translateX(${translateX}px)` : undefined,
          transition: isAnimating
            ? `transform ${SPRING_DURATION}ms cubic-bezier(0.2, 0.9, 0.3, 1)`
            : "none",
          willChange: translateX !== 0 ? "transform" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
};
