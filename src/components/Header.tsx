import { MessageCircle, Bookmark } from "lucide-react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useConversations } from "@/hooks/useConversations";
import { useState, useEffect, useRef } from "react";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { conversations } = useConversations();
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Spring-driven header offset for buttery smooth hide/show
  const headerY = useSpring(0, { stiffness: 300, damping: 30, mass: 0.8 });

  const totalUnreadMessages = conversations.reduce((total, conv) => total + conv.unread_count, 0);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y <= 10) {
          setHidden(false);
          headerY.set(0);
        } else if (y > lastScrollY.current + 5) {
          setHidden(true);
          headerY.set(-100);
        } else if (y < lastScrollY.current - 5) {
          setHidden(false);
          headerY.set(0);
        }
        lastScrollY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [headerY]);

  return (
    <motion.header
      className="sticky top-0 z-50 w-full bg-background border-b"
      style={{ y: headerY }}
    >
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Save button or spacer */}
        <div className="flex items-center w-10">
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => navigate('/saved')}
            >
              <Bookmark className="h-8 w-8 stroke-[2.5]" />
            </Button>
          )}
        </div>

        {/* Center: Title */}
        <h1
          className="text-3xl font-bold tracking-tight cursor-pointer"
          onClick={() => {
            if (window.location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/');
            }
          }}
        >
          Aelixto
        </h1>

        {/* Right: Messages or Sign In */}
        <div className="flex items-center w-10 justify-end">
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 relative"
              onClick={() => navigate('/messages')}
            >
              <MessageCircle className="h-8 w-8 stroke-[2.5]" />
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