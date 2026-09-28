import { MessageCircle, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useConversations } from "@/hooks/useConversations";
import { useState, useEffect, useRef } from "react";
import { useDailyPostLimit } from "@/hooks/useDailyPostLimit";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const { conversations } = useConversations();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const { remaining, limit } = useDailyPostLimit();
  // Continuous rotation in degrees. Even multiples of 360° = front (title),
  // odd multiples of 180° = back (credits ring).
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(true);
  const rotationRef = useRef(0);
  const dragStartX = useRef<number | null>(null);
  const dragStartRotation = useRef(0);
  const dragging = useRef(false);
  const autoReturnTimeout = useRef<number | null>(null);

  const setRotationSafe = (deg: number) => {
    rotationRef.current = deg;
    setRotation(deg);
  };

  const snapToNearestFront = (animate = true) => {
    // Snap to nearest multiple of 360° (front face)
    const current = rotationRef.current;
    const target = Math.round(current / 360) * 360;
    setAnimating(animate);
    setRotationSafe(target);
  };

  const scheduleReturn = (delay = 2500) => {
    if (autoReturnTimeout.current) window.clearTimeout(autoReturnTimeout.current);
    autoReturnTimeout.current = window.setTimeout(() => {
      snapToNearestFront(true);
    }, delay);
  };

  // Auto-spin once per session to reveal credits ring
  useEffect(() => {
    const KEY = 'aelixto-spin-shown';
    let cancelled = false;
    try {
      if (sessionStorage.getItem(KEY)) {
        setAnimating(false);
        setRotationSafe(0);
        return;
      }
      sessionStorage.setItem(KEY, '1');
    } catch {}

    // Start at 0, animate to 360 (one full spin) after a short delay
    setAnimating(false);
    setRotationSafe(0);
    const t1 = window.setTimeout(() => {
      if (cancelled) return;
      setAnimating(true);
      setRotationSafe(180); // show credits
      const t2 = window.setTimeout(() => {
        if (cancelled) return;
        setRotationSafe(360); // complete the spin back to front
      }, 900);
      (window as any).__aelixto_t2 = t2;
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      if ((window as any).__aelixto_t2) window.clearTimeout((window as any).__aelixto_t2);
      if (autoReturnTimeout.current) window.clearTimeout(autoReturnTimeout.current);
    };
  }, []);

  // Drag handlers (touch + mouse)
  const beginDrag = (clientX: number) => {
    dragging.current = true;
    dragStartX.current = clientX;
    dragStartRotation.current = rotationRef.current;
    setAnimating(false);
    if (autoReturnTimeout.current) {
      window.clearTimeout(autoReturnTimeout.current);
      autoReturnTimeout.current = null;
    }
  };

  const moveDrag = (clientX: number) => {
    if (!dragging.current || dragStartX.current === null) return;
    const dx = clientX - dragStartX.current;
    // ~1° per pixel — feels natural, 180px swipe = half turn
    const next = dragStartRotation.current + dx * 1.2;
    setRotationSafe(next);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    dragStartX.current = null;
    // Snap to nearest 180° step (so we land cleanly on front or back)
    const current = rotationRef.current;
    const target = Math.round(current / 180) * 180;
    setAnimating(true);
    setRotationSafe(target);
    // If we landed on credits side, auto-return to front shortly
    if (Math.abs(target % 360) === 180) {
      scheduleReturn(2500);
    }
  };

  const handleTap = () => {
    if (dragging.current) return;
    setAnimating(true);
    // Snap to nearest 180° (credits side), then auto-return to front
    const current = rotationRef.current;
    const nearestFront = Math.round(current / 360) * 360;
    setRotationSafe(nearestFront + 180);
    scheduleReturn(2500);
  };

  // Circular ring math
  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = (remaining / limit) * ringCircumference;

  // Count distinct people who have unread messages, not the number of messages
  const totalUnreadMessages = conversations.filter((conv) => conv.unread_count > 0).length;

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y <= 10) {
          setHidden(false);
        } else if (y > lastScrollY.current + 5) {
          setHidden(true);
        } else if (y < lastScrollY.current - 5) {
          setHidden(false);
        }
        lastScrollY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full bg-background border-b transition-transform duration-300 ease-out"
      style={{
        paddingTop: "var(--safe-top)",
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
      }}
    >
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Save button or spacer */}
        <div className="flex items-center w-10">
          {user && (
            <Button
              variant="ghost"
              size="icon"
className="h-14 w-14"
              onClick={() => navigate('/saved')}
            >
              <Bookmark className={`h-12 w-12 stroke-[2.5] transition-opacity ${location.pathname === '/saved' ? 'opacity-100' : 'opacity-50'}`} fill={location.pathname === '/saved' ? 'currentColor' : 'none'} />
            </Button>
          )}
        </div>

        {/* Center: Title */}
        <div
          className="cursor-pointer select-none touch-none"
          style={{ perspective: "800px" }}
          onClick={(e) => {
            // Suppress click if it was a drag
            if (Math.abs(rotationRef.current - dragStartRotation.current) > 8 && dragStartX.current === null) {
              return;
            }
            if (window.location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/');
            }
            handleTap();
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) beginDrag(t.clientX);
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (t) moveDrag(t.clientX);
          }}
          onTouchEnd={endDrag}
          onTouchCancel={endDrag}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') beginDrag(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse') moveDrag(e.clientX);
          }}
          onPointerUp={(e) => {
            if (e.pointerType === 'mouse') endDrag();
          }}
        >
          <div
            className="relative h-10"
            style={{
              transformStyle: "preserve-3d",
              transition: animating ? "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              transform: `rotateY(${rotation}deg)`,
              minWidth: "9rem",
            }}
          >
            <h1
              className="absolute inset-0 flex items-center justify-center text-3xl font-bold tracking-tight"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                color: "hsl(var(--brand-blue))",
              }}
            >
              Aelixto
            </h1>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
              aria-label={`${remaining} of ${limit} posts remaining today`}
            >
              <div className="relative h-10 w-10">
                <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r={ringRadius}
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r={ringRadius}
                    fill="none"
                    stroke="hsl(var(--foreground))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference - ringProgress}
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">
                  {remaining}/{limit}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Messages or Sign In */}
        <div className="flex items-center w-10 justify-end">
          {user && (
            <Button
              variant="ghost"
              size="icon"
className="h-14 w-14 relative"
              onClick={() => navigate('/messages')}
            >
              <MessageCircle className={`h-12 w-12 stroke-[2.5] transition-opacity ${location.pathname === '/messages' ? 'opacity-100' : 'opacity-50'}`} fill={location.pathname === '/messages' ? 'currentColor' : 'none'} />
              {totalUnreadMessages > 0 && (
                <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground flex items-center justify-center">
                  {totalUnreadMessages}
                </div>
              )}
            </Button>
          )}
          {!user && (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/auth')}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};