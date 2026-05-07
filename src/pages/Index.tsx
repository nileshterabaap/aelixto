import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { MemoizedHydratedFeedPost as FeedPost } from "@/components/HydratedFeedPost";
import { PostSkeleton } from "@/components/PostSkeleton";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { usePosts } from "@/hooks/usePosts";
import { useFollowingFeed } from "@/hooks/useFollowingFeed";
import { useSession } from "@/hooks/useSession";
import { useFeedAnchorRestoration } from "@/hooks/useFeedAnchorRestoration";
import { useMarkPostSeen } from "@/hooks/useMarkPostSeen";

import { useQueryClient } from "@tanstack/react-query";
import { useIframeScrollFreeze } from "@/hooks/useIframeScrollFreeze";
import { SwipeableView } from "@/components/SwipeableView";
const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  const hasRenderedOnce = useRef(false);
  const queryClient = useQueryClient();
  useIframeScrollFreeze();
  const { observePost } = useMarkPostSeen(user?.id);
  
  
  // Demo feed for signed-out users
  const { data: demoPostsData, isLoading: demoLoading } = usePosts();

  // Following feed for signed-in users
  const {
    items: followingPosts,
    empty: followingEmpty,
    loading: followingLoading,
    loadMore,
    hasMore,
  } = useFollowingFeed();

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const isSignedOut = !user;
  const showDemoFeed = isSignedOut && isDemoMode;

  // Map demo posts to feed format - stable memoization
  const mappedDemoPosts = useMemo(() => {
    if (!showDemoFeed || !demoPostsData) return [];

    return demoPostsData
      .map((post) => ({
        id: post.id,
        user_id: post.user_id,
        author: {
          name: post.profiles?.username || "Anonymous",
          username: `@${post.profiles?.username || "anonymous"}`,
          avatar:
            post.profiles?.avatar_url ||
           "",
        },
        title: post.title || "",
        content: post.content,
        mediaType: post.media_type as "image" | "video" | "none",
        mediaUrl: post.media_url || undefined,
        thumbnailUrl: post.thumbnail_url || undefined,
        platform: post.platform as
          | "youtube"
          | "instagram"
          | "tiktok"
          | "reddit"
          | "twitter"
          | "pinterest",
        embed_html: post.embed_html,
        timestamp: new Date(post.created_at),
        saves: post.saves_count,
        likes_count: (post as any).likes_count || 0,
        comments_count: (post as any).comments_count || 0,
        hide_likes: (post.profiles as any)?.settings?.hide_likes || false,
        isRealPost: true,
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [demoPostsData, showDemoFeed]);

  // Map following posts to feed format - stable memoization
  const feedPosts = useMemo(() => {
    if (showDemoFeed || !followingPosts.length) return [];

    return followingPosts.map((post) => ({
      id: post.id,
      user_id: post.user_id,
      author: {
        name: post.profiles?.username || "Anonymous",
        username: `@${post.profiles?.username || "anonymous"}`,
        avatar:
          post.profiles?.avatar_url ||
           "",
      },
      title: post.title || "",
      content: post.content,
      mediaType: post.media_type as "image" | "video" | "none",
      mediaUrl: post.media_url || undefined,
      thumbnailUrl: post.thumbnail_url || undefined,
      platform: post.platform as
        | "youtube"
        | "instagram"
        | "tiktok"
        | "reddit"
        | "twitter"
        | "pinterest",
      embed_html: post.embed_html,
      timestamp: new Date(post.created_at),
      saves: post.saves_count,
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      reposts_count: post.reposts_count || 0,
      isRealPost: true,
      isRepost: post.is_repost,
      repostedByUsername: post.reposted_by_username,
    }));
  }, [followingPosts, showDemoFeed]);

  const allPosts = showDemoFeed ? mappedDemoPosts : feedPosts;
  

  const { registerItem } = useFeedAnchorRestoration(
    "/",
    useMemo(() => allPosts.map((p) => p.id), [allPosts])
  );

  useEffect(() => {
    if (!sessionLoading && !user && !isDemoMode) {
      navigate("/auth");
    }
  }, [user, sessionLoading, isDemoMode, navigate]);

  // Mark first render complete to prevent flicker on subsequent renders
  useEffect(() => {
    if (allPosts.length > 0) {
      hasRenderedOnce.current = true;
    }
  }, [allPosts.length]);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: showDemoFeed ? ["posts"] : ["following-feed"] });
  }, [queryClient, showDemoFeed]);

  // Aggressive invisible pagination — start loading the next page the moment
  // the first post becomes visible, and keep chain-loading subsequent pages
  // immediately as long as the user is scrolling (or even before). This keeps
  // a huge buffer of posts ready ahead of the user, Instagram/X-style.
  useEffect(() => {
    if (!hasMore || showDemoFeed) return;
    // Fire immediately on every render where more pages exist — the hook
    // itself dedupes with isFetchingNextPage, so this is safe.
    loadMore();
  }, [hasMore, loadMore, showDemoFeed, allPosts.length]);

  // Only show skeleton on truly empty first load - prevent flicker
  const loading = showDemoFeed ? demoLoading : followingLoading;
  const shouldShowSkeleton = !hasRenderedOnce.current && (sessionLoading || loading) && allPosts.length === 0;

  if (shouldShowSkeleton) {
    return (
      <SwipeableView leftRoute="/saved" rightRoute="/messages" leftLabel="Saved" rightLabel="Messages">
        <div className="min-h-screen bg-background pb-20">
          <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
          <main className="mx-auto max-w-2xl px-4 py-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <PostSkeleton key={i} />
              ))}
            </div>
          </main>
          <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />
        </div>
      </SwipeableView>
    );
  }

  return (
    <SwipeableView leftRoute="/saved" rightRoute="/messages" leftLabel="Saved" rightLabel="Messages">
      <div className="min-h-screen bg-background pb-20">
        <Header onCreatePost={() => setIsCreateDialogOpen(true)} />

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="mx-auto max-w-2xl px-4 py-6">
          {!showDemoFeed && followingEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h2 className="text-xl font-semibold">Nothing here yet 👀</h2>
              <p className="text-sm text-muted-foreground mt-2">
                No algorithm should decide your feed..
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                only your follows do.
              </p>
              <Link
                to="/discover"
                className="mt-4 px-4 py-2 rounded-full border border-foreground/30 hover:bg-foreground hover:text-background transition-all"
              >
                Discover people to follow
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {allPosts.map((post, index) => (
                <div 
                  key={post.id} 
                  ref={(el) => {
                    registerItem(post.id)(el);
                    if (!showDemoFeed && el) observePost(post.id)(el as HTMLDivElement);
                    if (index === prefetchTriggerIndex) {
                      (prefetchSentinelRef as any).current = el;
                    }
                  }}
                  data-feed-item-id={post.id}
                >
                  <FeedPost 
                    post={post} 
                    userId={user?.id} 
                    startHydrated={index < 4}
                  />
                </div>
              ))}
              {/* No visible loader — pagination happens silently far before
                  the user reaches the end. */}
              {/* All caught up message */}
              {!hasMore && !showDemoFeed && allPosts.length > 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
                  <h3 className="text-lg font-semibold">You're all caught up</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You've seen all recent posts from people you follow.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </PullToRefresh>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

        <CreatePostDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      </div>
    </SwipeableView>
  );
};

export default Index;

