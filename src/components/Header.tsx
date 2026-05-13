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
  const [flipped, setFlipped] = useState(false);
  const flipTimeout = useRef<number | null>(null);
  const flipInProgress = useRef(false);
  const touchStartY = useRef<number | null>(null);

  const triggerFlip = () => {
    if (flipInProgress.current) return;
    flipInProgress.current = true;
    setFlipped(true);
    if (flipTimeout.current) window.clearTimeout(flipTimeout.current);
    flipTimeout.current = window.setTimeout(() => {
      setFlipped(false);
      // allow back-flip animation (0.5s) to finish before re-enabling
      window.setTimeout(() => {
        flipInProgress.current = false;
      }, 550);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (flipTimeout.current) window.clearTimeout(flipTimeout.current);
    };
  }, []);

  // Circular ring math
  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = (remaining / limit) * ringCircumference;

  const totalUnreadMessages = conversations.reduce((total, conv) => total + conv.unread_count, 0);

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
          className="cursor-pointer select-none"
          style={{ perspective: "800px" }}
          onClick={() => {
            if (flipped || flipInProgress.current) return;
            if (window.location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/');
            }
          }}
          onTouchStart={(e) => {
            touchStartY.current = e.touches[0]?.clientY ?? null;
          }}
          onTouchMove={(e) => {
            if (touchStartY.current == null) return;
            const dy = (e.touches[0]?.clientY ?? touchStartY.current) - touchStartY.current;
            if (dy > 18) {
              touchStartY.current = null;
              triggerFlip();
            }
          }}
          onTouchEnd={() => {
            touchStartY.current = null;
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            triggerFlip();
          }}
        >
          <div
            className="relative h-10"
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.5s ease",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              minWidth: "9rem",
            }}
          >
            <h1
              className="absolute inset-0 flex items-center justify-center text-3xl font-bold tracking-tight"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              onClick={(e) => {
                // Single tap also flips when on home (already at top)
                if (window.location.pathname === '/' && window.scrollY <= 4) {
                  e.stopPropagation();
                  triggerFlip();
                }
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