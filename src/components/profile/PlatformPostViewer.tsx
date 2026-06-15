import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { HydratedFeedPost } from "@/components/HydratedFeedPost";
import { PostSkeleton } from "@/components/PostSkeleton";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/useSession";
import { markPostsSeenImmediate } from "@/hooks/useMarkPostSeen";
import { supabase } from "@/integrations/supabase/client";
import type { Post } from "@/data/demoData";
import type { PlatformPost } from "@/hooks/useUserPlatformPosts";
import type { PlatformTab } from "@/hooks/useUserPlatformTabs";

interface PlatformPostViewerProps {
  userId: string;
  posts: PlatformPost[];
  loading: boolean;
  initialPostId: string;
  initialPostIndex: number;
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

// Render all posts so users can scroll UP to see posts above the tapped one
// and DOWN to see posts below. We anchor the scroll position to the tapped
// post on mount and keep it anchored while posts above hydrate (their height
// changes), until the user starts scrolling themselves.

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
  initialPostIndex,
  tabs,
  activeTab,
  onClose,
  onTabChange,
}: PlatformPostViewerProps) => {
  const { user } = useSession();
  // Use react-query so the profile is cached across viewer opens — instant after first load.
  const { data: profileData = null } = useQuery({
    queryKey: ["viewer-profile", userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<ProfileData | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("user_id", userId)
        .single();
      if (error) return null;
      return data as ProfileData;
    },
  });
  const [portalReady, setPortalReady] = useState(false);
  // Gate the inner content for one paint so the modal's enter animation
  // (opacity/scale) always plays visibly — otherwise, when profile + posts
  // are cached, content commits on the same frame as the modal mounts and
  // the user perceives an instant jump with no transition.
  const [contentReady, setContentReady] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Persist scroll-locked state across effect re-runs. Without this, if
  // `posts`/`profileData`/etc change after the user has already started
  // scrolling, the anchoring effect re-runs with userScrolled=false and
  // re-grabs the scroll position — producing the "treadmill" feel where
  // the page keeps snapping back as you scroll.
  const userScrolledRef = useRef(false);
  // Reset the lock only when the viewer is opened to a new target post
  // (e.g. user tapped a different grid item).
  useEffect(() => {
    userScrolledRef.current = false;
  }, [initialPostId]);
  const initialIdx = useMemo(
    () => {
      if (initialPostIndex >= 0 && initialPostIndex < posts.length) {
        return initialPostIndex;
      }
      return posts.findIndex((post) => post.id === initialPostId);
    },
    [posts, initialPostId, initialPostIndex]
  );
  const targetPostId = initialIdx >= 0 ? posts[initialIdx]?.id : undefined;
  
  // Touch handling for swipe
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    setPortalReady(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Reveal content shortly after mount so the entry animation always plays.
  useEffect(() => {
    const t = window.setTimeout(() => setContentReady(true), 180);
    return () => window.clearTimeout(t);
  }, []);

  // Anchor scroll to the tapped post and keep it anchored while posts above
  // hydrate. Stops anchoring once the user scrolls.
  useLayoutEffect(() => {
    if (!portalReady || !contentReady || !targetPostId || !profileData) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    let cancelled = false;
    let lastScrollTop = container.scrollTop;

    const anchor = () => {
      if (cancelled || userScrolledRef.current) return;
      const target = postRefs.current.get(targetPostId);
      if (!target) return;
      const targetRect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const desired =
        container.scrollTop + (targetRect.top - containerRect.top);
      const maxScroll = container.scrollHeight - container.clientHeight;
      const clamped = Math.max(0, Math.min(desired, maxScroll));
      if (Math.abs(container.scrollTop - clamped) > 1) {
        container.scrollTop = clamped;
        lastScrollTop = clamped;
      }
    };

    // Initial anchor on two frames to catch layout commit
    requestAnimationFrame(() => {
      anchor();
      requestAnimationFrame(anchor);
    });

    // Re-anchor whenever posts above (or the target) resize during hydration.
    // We observe ALL post refs (including the live set that get registered
    // after this effect runs) plus the inner scroll-content so any embed
    // hydration above the target re-anchors us to the right post.
    const ro = new ResizeObserver(() => {
      if (userScrolledRef.current) return;
      requestAnimationFrame(anchor);
    });
    postRefs.current.forEach((el) => ro.observe(el));
    // Observe new posts as they mount, and re-anchor on any DOM mutation
    // (embeds inject iframes/images that change height long after mount).
    const mo = new MutationObserver(() => {
      if (userScrolledRef.current) return;
      postRefs.current.forEach((el) => {
        try { ro.observe(el); } catch { /* already observed */ }
      });
      requestAnimationFrame(anchor);
    });
    mo.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "height"] });
    // Iframe load events are the strongest signal for embed height changes.
    const onAnyLoad = (e: Event) => {
      if (userScrolledRef.current) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.tagName === "IFRAME" || t.tagName === "IMG") {
        requestAnimationFrame(anchor);
      }
    };
    container.addEventListener("load", onAnyLoad, true);

    const markScrolled = () => {
      userScrolledRef.current = true;
      ro.disconnect();
      mo.disconnect();
    };
    container.addEventListener("wheel", markScrolled, { passive: true });
    container.addEventListener("touchmove", markScrolled, { passive: true });
    container.addEventListener("pointerdown", markScrolled, { passive: true });
    container.addEventListener("touchstart", markScrolled, { passive: true });
    container.addEventListener("keydown", markScrolled, { passive: true });
    // Last-resort: any genuine scroll delta the observers didn't catch
    // (momentum, scrollbar drag, programmatic-but-user-initiated) trips
    // the lock so anchoring can never fight the user.
    const onScroll = () => {
      if (userScrolledRef.current) return;
      const delta = Math.abs(container.scrollTop - lastScrollTop);
      // Ignore tiny sub-pixel adjustments from our own anchor() writes.
      if (delta > 8) {
        markScrolled();
      }
      lastScrollTop = container.scrollTop;
    };
    container.addEventListener("scroll", onScroll, { passive: true });

    // Safety: stop anchoring after 12s — long enough for slow embeds to
    // finish hydrating, short enough to never feel sticky.
    const safetyTimeout = window.setTimeout(() => {
      cancelled = true;
      ro.disconnect();
      mo.disconnect();
    }, 4000);

    return () => {
      cancelled = true;
      ro.disconnect();
      mo.disconnect();
      window.clearTimeout(safetyTimeout);
      container.removeEventListener("wheel", markScrolled);
      container.removeEventListener("touchmove", markScrolled);
      container.removeEventListener("pointerdown", markScrolled);
      container.removeEventListener("touchstart", markScrolled);
      container.removeEventListener("keydown", markScrolled);
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("load", onAnyLoad, true);
    };
  }, [portalReady, contentReady, targetPostId, posts, initialIdx, activeTab, profileData]);

  // NOTE: Bulk marking posts as seen in profile viewer is intentionally
  // disabled. Posts should only be marked seen via the Home feed's
  // scroll-based 50% visibility + 1.5s dwell logic.

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

  // Gate post rendering until profile is loaded so the author header never
  // flashes "Unknown". Also wait for one paint after mount so the modal's
  // enter animation has a chance to play (otherwise cached opens look instant).
  const profileReady = !!profileData && contentReady;

  const viewer = (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
          {(loading && posts.length === 0) || !profileReady ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PostSkeleton />
                </motion.div>
              ))}
            </>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No posts in this section</p>
            </div>
          ) : (
            posts.map((post, idx) => (
              <motion.div
                key={post.id}
                ref={(el) => {
                  if (el) postRefs.current.set(post.id, el);
                  else postRefs.current.delete(post.id);
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  delay: Math.min(Math.abs(idx - initialIdx), 4) * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <HydratedFeedPost
                  post={transformPost(post, profileData)}
                  userId={user?.id}
                  startHydrated={true}
                />
              </motion.div>
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
    </motion.div>
  );

  if (!portalReady) return null;
  return createPortal(viewer, document.body);
};
