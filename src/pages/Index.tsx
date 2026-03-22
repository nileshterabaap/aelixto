import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { MemoizedHydratedFeedPost as FeedPost } from "@/components/HydratedFeedPost";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { usePosts } from "@/hooks/usePosts";
import { useFollowingFeed } from "@/hooks/useFollowingFeed";
import { useSession } from "@/hooks/useSession";
import { useFeedAnchorRestoration } from "@/hooks/useFeedAnchorRestoration";

import { useQueryClient } from "@tanstack/react-query";

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  const hasRenderedOnce = useRef(false);
  const queryClient = useQueryClient();
  const [loadedPosts, setLoadedPosts] = useState<Set<string>>(new Set());
  
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
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
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
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
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
      comments_count: (post as any).comments_count || 0,
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
    setLoadedPosts(new Set());
    await queryClient.invalidateQueries({ queryKey: showDemoFeed ? ["posts"] : ["following-feed"] });
  }, [queryClient, showDemoFeed]);

  const handlePostLoaded = useCallback((postId: string) => {
    setLoadedPosts(prev => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  }, []);

  // Prefetch next page when user is within last 5 posts
  const prefetchSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || showDemoFeed) return;
    const el = prefetchSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '1500px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, showDemoFeed, allPosts.length]);

  // Only show skeleton on truly empty first load - prevent flicker
  const loading = showDemoFeed ? demoLoading : followingLoading;
  const shouldShowSkeleton = !hasRenderedOnce.current && (sessionLoading || loading) && allPosts.length === 0;

  if (shouldShowSkeleton) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
        <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="mx-auto max-w-2xl px-4 py-6">
          {!showDemoFeed && followingEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h2 className="text-xl font-semibold">No posts yet</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Posts from people you follow will appear here once they share something.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start by following creators you like to fill your feed ✨
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
              {allPosts.map((post, index) => {
                const isPostLoaded = loadedPosts.has(post.id);
                const nextPost = allPosts[index + 1];
                const isNextLoaded = nextPost ? loadedPosts.has(nextPost.id) : true;

                return (
                  <div key={post.id}>
                    {/* Spinner shown while this post is loading */}
                    {!isPostLoaded && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div
                      ref={(el) => { registerItem(post.id)(el); }}
                      data-feed-item-id={post.id}
                    >
                      <FeedPost 
                        post={post} 
                        userId={user?.id} 
                        startHydrated={index < 8}
                        onLoaded={() => handlePostLoaded(post.id)}
                      />
                    </div>
                  </div>
                );
              })}
              {/* Sentinel for prefetching next page ahead of scroll */}
              {hasMore && !showDemoFeed && (
                <div ref={prefetchSentinelRef} style={{ height: 1 }} />
              )}
            </div>
          )}
        </main>
      </PullToRefresh>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </div>
  );
};

export default Index;

