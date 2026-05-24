import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HydratedFeedPost } from "@/components/HydratedFeedPost";
import { PlatformPost } from "@/hooks/useUserPlatformPosts";
import { useSession } from "@/hooks/useSession";
import { markPostsSeenImmediate } from "@/hooks/useMarkPostSeen";
import type { Post } from "@/data/demoData";
import type { PlatformTab } from "@/hooks/useUserPlatformTabs";

interface PlatformPostViewerProps {
  userId: string;
  posts: PlatformPost[];
  loading: boolean;
  initialPostId: string;
  tabs: PlatformTab[];
  activeTab: string;
  onClose: () => void;
  onTabChange: (tab: string) => void;
}

interface ProfileData {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

const WINDOW_FORWARD = 8;
const WINDOW_STEP = 6;
const EXPAND_EDGE_PX = 700;

const getInitialRange = (length: number, index: number) => {
  if (length === 0) return { start: 0, end: -1 };
  const safeIndex = index >= 0 ? index : 0;
  return {
    start: safeIndex,
    end: Math.min(length - 1, safeIndex + WINDOW_FORWARD),
  };
};

function transformPost(post: PlatformPost, profileData?: ProfileData): Post & { isRealPost: boolean; user_id: string; likes_count: number; comments_count: number } {
  const postUserId = post.original_user_id || post.user_id;
  return {
    id: post.id,
    user_id: postUserId,
    author: {
      name: profileData?.display_name || profileData?.username || "Unknown",
      username: profileData?.username || "unknown",
      avatar: profileData?.avatar_url || "",
    },
    title: post.title || "",
    content: post.content,
    mediaType: (post.media_type as "image" | "video") || "none",
    mediaUrl: post.media_url || undefined,
    thumbnailUrl: post.thumbnail_url || undefined,
    platform: post.platform as any,
    embed_html: post.embed_html,
    timestamp: new Date(post.created_at),
    saves: post.saves_count,
    likes_count: post.likes_count || 0,
    comments_count: 0,
    isRealPost: true,
  } as any;
}

export const PlatformPostViewer = ({
  userId,
  posts,
  loading,
  initialPostId,
  tabs,
  activeTab,
  onClose,
  onTabChange,
}: PlatformPostViewerProps) => {
  const { user } = useSession();
  const { items, loading } = useUserPlatformPosts(userId, activeTab);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // Touch handling for swipe
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Fetch profile data for post author info
  useEffect(() => {
    if (!userId) return;
    
    const fetchProfile = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .eq("user_id", userId)
          .single();
        
        if (error) {
          console.error("[PlatformPostViewer] Error fetching profile:", error);
          return;
        }
        if (data) setProfileData(data);
      } catch (err) {
        console.error("[PlatformPostViewer] Failed to fetch profile:", err);
      }
    };
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    setPortalReady(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Scroll to the tapped post. Posts above hydrate asynchronously and grow,
  // which would push the target down — so we observe size changes on the
  // posts above the target and re-anchor until the user scrolls manually.
  useEffect(() => {
    if (items.length === 0 || !initialPostId) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const targetIdx = items.findIndex(p => p.id === initialPostId);
    if (targetIdx < 0) return;

    let cancelled = false;
    const onUserScroll = () => { cancelled = true; cleanup(); };

    const anchor = () => {
      if (cancelled) return;
      const target = postRefs.current.get(initialPostId);
      if (!target) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const desired =
        container.scrollTop + (targetRect.top - containerRect.top);
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const clamped = Math.max(0, Math.min(desired, maxScroll));
      if (Math.abs(container.scrollTop - clamped) > 1) {
        container.scrollTop = clamped;
      }
    };

    // Initial anchor on next two frames (after layout commit)
    requestAnimationFrame(() => {
      anchor();
      requestAnimationFrame(anchor);
    });

    // Re-anchor whenever any post above the target resizes (hydration)
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(anchor);
    });
    for (let i = 0; i <= targetIdx; i++) {
      const el = postRefs.current.get(items[i].id);
      if (el) ro.observe(el);
    }

    // Safety: stop after 3s regardless
    const stopTimer = window.setTimeout(() => cleanup(), 3000);

    const cancelEvents = ["wheel", "touchmove", "keydown"] as const;
    cancelEvents.forEach(e =>
      container.addEventListener(e, onUserScroll, { passive: true })
    );

    function cleanup() {
      ro.disconnect();
      window.clearTimeout(stopTimer);
      cancelEvents.forEach(e => container.removeEventListener(e, onUserScroll));
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [items, initialPostId, activeTab]);

  // Mark all visible posts as seen when viewing profile posts
  useEffect(() => {
    if (user?.id && items.length > 0) {
      markPostsSeenImmediate(user.id, items.map(p => p.id));
    }
  }, [user?.id, items]);

  // Get adjacent tabs for swipe navigation
  const currentTabIndex = tabs.findIndex(t => t.key === activeTab);
  const prevTab = currentTabIndex > 0 ? tabs[currentTabIndex - 1] : null;
  const nextTab = currentTabIndex < tabs.length - 1 ? tabs[currentTabIndex + 1] : null;

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 80;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && nextTab) {
        // Swiped left - go to next platform
        onTabChange(nextTab.key);
      } else if (diff < 0 && prevTab) {
        // Swiped right - go to previous platform
        onTabChange(prevTab.key);
      }
    }
  }, [nextTab, prevTab, onTabChange]);

  const currentTab = tabs.find(t => t.key === activeTab);

  const viewer = (
    <div 
      className="fixed inset-0 z-[70] bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            {prevTab && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onTabChange(prevTab.key)}
                className="rounded-full h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            
            {currentTab && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                <img src={currentTab.icon} alt={currentTab.label} className="w-5 h-5" />
                <span className="font-medium text-sm">{currentTab.label}</span>
              </div>
            )}
            
            {nextTab && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onTabChange(nextTab.key)}
                className="rounded-full h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Scrollable posts */}
      <div 
        ref={scrollContainerRef}
        className="h-[calc(100dvh-56px)] overflow-y-auto overscroll-contain pb-8"
      >
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-6">
          {loading && items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading posts...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No posts in this section</p>
            </div>
          ) : (
            items.map((post) => (
              <div
                key={post.id}
                ref={(el) => {
                  if (el) postRefs.current.set(post.id, el);
                }}
              >
                <HydratedFeedPost
                  post={transformPost(post, profileData || undefined)}
                  userId={user?.id}
                  startHydrated={(() => {
                    const idx = items.findIndex(p => p.id === initialPostId);
                    const postIdx = items.findIndex(p => p.id === post.id);
                    return idx >= 0 && Math.abs(postIdx - idx) <= 5;
                  })()}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Swipe indicators */}
      <div className="fixed bottom-4 left-0 right-0 flex justify-center gap-2 pointer-events-none">
        {tabs.map((tab, index) => (
          <div
            key={tab.key}
            className={`w-2 h-2 rounded-full transition-colors ${
              tab.key === activeTab ? "bg-foreground" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );

  if (!portalReady) return null;
  return createPortal(viewer, document.body);
};
