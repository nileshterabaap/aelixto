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
import { getEmbedStatus, subscribeEmbedReadiness } from "@/lib/embedReadiness";

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

// Platforms whose embeds hydrate late and resize a lot. For these we render a
// tight window around the tapped post first (radius 0) and widen it in the
// background with scroll anchoring — this is what removed the "treadmill"
// feel on X, and it applies identically to the other heavy embed platforms.
const X_PLATFORMS = new Set([
  "x",
  "twitter",
  "instagram",
  "pinterest",
  "facebook",
  "youtube",
  "tiktok",
]);
const INITIAL_X_WINDOW_RADIUS = 0;
const BACKGROUND_X_WINDOW_RADIUS = 2;
const X_WINDOW_EXPAND_STEP = 4;
const X_WINDOW_EDGE_PX = 900;

const getXViewerRange = (length: number, index: number, radius: number) => {
  if (length === 0) return { start: 0, end: -1 };
  const safeIndex = index >= 0 ? index : 0;
  return {
    start: Math.max(0, safeIndex - radius),
    end: Math.min(length - 1, safeIndex + radius),
  };
};

// Render all posts so users can scroll UP to see posts above the tapped one
// and DOWN to see posts below. We anchor the scroll position to the tapped
// post on mount and keep it anchored while posts above hydrate (their height
// changes), until the user starts scrolling themselves.

function transformPost(post: PlatformPost, profileData?: ProfileData): Post & { isRealPost: boolean; user_id: string; likes_count: number; comments_count: number } {
  // Ownership = the row's user_id (i.e. who owns this post/repost on this profile).
  // Using original_user_id here would hide the Delete button on your own reposts.
  const postUserId = post.is_repost ? String((post as any).profile_owner_id || post.user_id) : post.user_id;
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
    preview_text: post.preview_text,
    preview_title: post.preview_title,
    preview_image_url: post.preview_image_url,
    media_kind: post.media_kind,
    aspect_ratio: post.aspect_ratio,
    suggested_height: post.suggested_height,
    platform: post.platform as any,
    embed_html: post.embed_html,
    timestamp: new Date(post.created_at),
    saves: post.saves_count,
    likes_count: post.likes_count || 0,
    comments_count: 0,
    isRepost: !!post.is_repost,
    isRealPost: true,
    pinned_at: (post as any).pinned_at ?? null,
    hide_counts: !!(post as any).hide_counts,
    comments_disabled: !!(post as any).comments_disabled,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingPrependAnchor = useRef<{ postId: string; top: number } | null>(null);
  // Fires exactly once when the tapped target post is first attached to
  // the DOM — used to synchronously scroll the container to that post
  // BEFORE the browser paints, so post #0 never flashes.
  const initialAnchorDoneRef = useRef(false);
  // Hide the tapped target post until its first iframe/image has fully
  // rendered AND its height has stabilised so users don't see the
  // Instagram "tall footer → trimmed" flash. Falls back after 1400ms so
  // slow embeds never leave the post invisible.
  const [targetReady, setTargetReady] = useState(false);
  useEffect(() => {
    setTargetReady(false);
    // Let the post shell appear almost instantly; the embed renders its own
    // skeleton while third-party SDKs finish inside the card.
    const check = () => {
      if (getEmbedStatus(initialPostId) === "ready") {
        setTargetReady(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const unsub = subscribeEmbedReadiness(() => { check(); });
    const cap = window.setTimeout(() => setTargetReady(true), 180);
    return () => { unsub(); window.clearTimeout(cap); };
  }, [initialPostId]);
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
    initialAnchorDoneRef.current = false;
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
  const isXViewer = useMemo(() => {
    const tab = (activeTab || "").toLowerCase();
    const targetPlatform = String(posts[initialIdx]?.platform || "").toLowerCase();
    return X_PLATFORMS.has(tab) || X_PLATFORMS.has(targetPlatform);
  }, [activeTab, posts, initialIdx]);
  const [renderRange, setRenderRange] = useState(() =>
    getXViewerRange(posts.length, initialIdx, INITIAL_X_WINDOW_RADIUS)
  );
  const renderedPosts = useMemo(
    () => isXViewer ? posts.slice(renderRange.start, renderRange.end + 1) : posts,
    [isXViewer, posts, renderRange.start, renderRange.end]
  );
  const renderedPostsRef = useRef(renderedPosts);
  renderedPostsRef.current = renderedPosts;

  useEffect(() => {
    postRefs.current.clear();
    pendingPrependAnchor.current = null;
    if (isXViewer) {
      setRenderRange(getXViewerRange(posts.length, initialIdx, INITIAL_X_WINDOW_RADIUS));
    } else {
      setRenderRange({ start: 0, end: posts.length - 1 });
    }
  }, [isXViewer, posts.length, initialIdx, initialPostId, activeTab]);

  useEffect(() => {
    if (!isXViewer || initialIdx < 0) return;
    const t = window.setTimeout(() => {
      // Record a scroll anchor BEFORE widening the window backwards.
      // Without this, prepending posts above pushes the content down and the
      // viewer ends up showing a different post than the one that was tapped.
      const container = scrollContainerRef.current;
      const firstId = renderedPostsRef.current[0]?.id;
      if (container && firstId) {
        const el = postRefs.current.get(firstId);
        if (el) {
          pendingPrependAnchor.current = { postId: firstId, top: el.getBoundingClientRect().top };
        }
      }
      setRenderRange(getXViewerRange(posts.length, initialIdx, BACKGROUND_X_WINDOW_RADIUS));
    }, 900);
    return () => window.clearTimeout(t);
  }, [isXViewer, posts.length, initialIdx, initialPostId]);

  useLayoutEffect(() => {
    if (!isXViewer) return;
    const anchor = pendingPrependAnchor.current;
    const container = scrollContainerRef.current;
    if (!anchor || !container) return;
    const el = postRefs.current.get(anchor.postId);
    if (el) {
      container.scrollTop += el.getBoundingClientRect().top - anchor.top;
    }
    pendingPrependAnchor.current = null;
  }, [isXViewer, renderRange.start]);

  const expandXWindowIfNeeded = useCallback(() => {
    if (!isXViewer) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    if (container.scrollTop < X_WINDOW_EDGE_PX && renderRange.start > 0 && renderedPosts.length > 0) {
      const firstPost = renderedPosts[0];
      const firstEl = postRefs.current.get(firstPost.id);
      if (firstEl) {
        pendingPrependAnchor.current = { postId: firstPost.id, top: firstEl.getBoundingClientRect().top };
      }
      setRenderRange((current) => ({
        ...current,
        start: Math.max(0, current.start - X_WINDOW_EXPAND_STEP),
      }));
    }

    const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    if (distanceFromBottom < X_WINDOW_EDGE_PX && renderRange.end < posts.length - 1) {
      setRenderRange((current) => ({
        ...current,
        end: Math.min(posts.length - 1, current.end + X_WINDOW_EXPAND_STEP),
      }));
    }
  }, [isXViewer, posts.length, renderRange.end, renderRange.start, renderedPosts]);

  useEffect(() => {
    if (!isXViewer) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => expandXWindowIfNeeded();
    container.addEventListener("scroll", onScroll, { passive: true });
    requestAnimationFrame(onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [isXViewer, expandXWindowIfNeeded]);
  
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

  // Anchor scroll to the tapped post and keep it anchored while posts above
  // hydrate. Stops anchoring once the user scrolls.
  useLayoutEffect(() => {
    if (!portalReady || !targetPostId) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    let cancelled = false;
    let lastScrollTop = container.scrollTop;
    // Timestamp of the last genuine pointer/touch contact inside the viewer.
    // Scroll deltas that happen without recent contact are layout-driven
    // (embed hydration, browser scroll anchoring) — never user intent.
    let lastPointerAt = 0;

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
    container.addEventListener("keydown", markScrolled, { passive: true });
    // Touches that start on a cross-origin embed iframe (X, etc.) never
    // bubble to the container, so the container-level listeners above never
    // fire and anchoring keeps fighting the user ("treadmill"). Listen on
    // window in capture phase as well.
    window.addEventListener("wheel", markScrolled, { passive: true, capture: true });
    window.addEventListener("touchmove", markScrolled, { passive: true, capture: true });
    // Last-resort: any genuine scroll delta the observers didn't catch
    // (momentum, scrollbar drag, programmatic-but-user-initiated) trips
    // the lock so anchoring can never fight the user.
    const onScroll = () => {
      if (userScrolledRef.current) return;
      const delta = Math.abs(container.scrollTop - lastScrollTop);
      // Ignore adjustments that aren't backed by a recent finger/pointer
      // contact — those come from embeds resizing above the target.
      if (delta > 8 && performance.now() - lastPointerAt < 700) {
        markScrolled();
      }
      lastScrollTop = container.scrollTop;
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    const onPointerContact = () => { lastPointerAt = performance.now(); };
    container.addEventListener("pointerdown", onPointerContact, { passive: true, capture: true });
    container.addEventListener("touchstart", onPointerContact, { passive: true, capture: true });
    window.addEventListener("pointerdown", onPointerContact, { passive: true, capture: true });
    window.addEventListener("touchstart", onPointerContact, { passive: true, capture: true });

    // Safety: stop anchoring after 12s — long enough for slow embeds to
    // finish hydrating, short enough to never feel sticky.
    const safetyTimeout = window.setTimeout(() => {
      cancelled = true;
      ro.disconnect();
      mo.disconnect();
    }, 12000);

    return () => {
      cancelled = true;
      ro.disconnect();
      mo.disconnect();
      window.clearTimeout(safetyTimeout);
      container.removeEventListener("wheel", markScrolled);
      container.removeEventListener("touchmove", markScrolled);
      container.removeEventListener("keydown", markScrolled);
      window.removeEventListener("wheel", markScrolled, true);
      window.removeEventListener("touchmove", markScrolled, true);
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("pointerdown", onPointerContact, true);
      container.removeEventListener("touchstart", onPointerContact, true);
      window.removeEventListener("pointerdown", onPointerContact, true);
      window.removeEventListener("touchstart", onPointerContact, true);
      container.removeEventListener("load", onAnyLoad, true);
    };
  }, [portalReady, targetPostId, posts, initialIdx, activeTab]);

  // Mark all visible posts as seen when viewing profile posts
  useEffect(() => {
    if (user?.id && posts.length > 0) {
      markPostsSeenImmediate(user.id, posts.map(p => p.id));
    }
  }, [user?.id, posts]);

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

  // Render immediately — the profile header hydrates async without gating
  // the tapped post. Waiting on `profileData` used to delay first paint by
  // hundreds of ms and caused the "wrong post opens" bug on cold taps.
  const profileReady = true;

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
            renderedPosts.map((post, idx) => {
              const absoluteIdx = isXViewer ? renderRange.start + idx : idx;
              return (
              <motion.div
                key={post.id}
                ref={(el) => {
                  if (el) postRefs.current.set(post.id, el);
                  else postRefs.current.delete(post.id);
                  // Synchronously scroll to the tapped post the moment its
                  // node mounts — before paint, before profile hydrates.
                  // This eliminates the "wrong post opens for 5-7s" bug.
                  if (
                    el &&
                    post.id === targetPostId &&
                    !initialAnchorDoneRef.current &&
                    !userScrolledRef.current
                  ) {
                    const container = scrollContainerRef.current;
                    if (container) {
                      const targetRect = el.getBoundingClientRect();
                      const containerRect = container.getBoundingClientRect();
                      container.scrollTop =
                        container.scrollTop + (targetRect.top - containerRect.top);
                      initialAnchorDoneRef.current = true;
                    }
                  }
                }}
                initial={post.id === targetPostId ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={
                  post.id === targetPostId && !targetReady
                    ? { opacity: 0 }
                    : undefined
                }
                transition={{
                  duration: 0.28,
                  delay: Math.min(Math.abs(absoluteIdx - initialIdx), 4) * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className="relative">
                  {post.id === targetPostId && !targetReady && (
                    <div className="absolute inset-0 z-10">
                      <PostSkeleton />
                    </div>
                  )}
                  <HydratedFeedPost
                    post={transformPost(post, profileData)}
                    onDeleted={() => {
                      // Stay inside the viewer after deleting. Only close it
                      // when this was the last post in the grid.
                      if (posts.length <= 1) onClose();
                    }}
                    userId={user?.id}
                    startHydrated={true}
                    fastReveal={isXViewer && post.id === targetPostId}
                  />
                </div>
              </motion.div>
              );
            })
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
