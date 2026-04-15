import { useEffect, useRef, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HydratedFeedPost } from "@/components/HydratedFeedPost";
import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { useSession } from "@/hooks/useSession";
import { markPostsSeenImmediate } from "@/hooks/useMarkPostSeen";
import type { Post } from "@/data/demoData";
import type { PlatformTab } from "@/hooks/useUserPlatformTabs";

interface PlatformPostViewerProps {
  userId: string;
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
  initialPostId,
  tabs,
  activeTab,
  onClose,
  onTabChange,
}: PlatformPostViewerProps) => {
  const { user } = useSession();
  const { items, loading } = useUserPlatformPosts(userId, activeTab);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
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

  // Scroll to initial post when items load
  useEffect(() => {
    if (items.length > 0 && initialPostId) {
      // Small delay to ensure refs are set
      setTimeout(() => {
        const targetRef = postRefs.current.get(initialPostId);
        if (targetRef) {
          targetRef.scrollIntoView({ behavior: "auto", block: "start" });
        }
      }, 100);
    }
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

  return (
    <div 
      className="fixed inset-0 z-50 bg-background"
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
        className="h-[calc(100vh-56px)] overflow-y-auto pb-8"
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
                    return idx >= 0 && Math.abs(postIdx - idx) <= 1;
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
};
