import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIframeScrollFreeze } from "@/hooks/useIframeScrollFreeze";
import { SwipeableView } from "@/components/SwipeableView";
const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));
  const hasRenderedOnce = useRef(false);
  const queryClient = useQueryClient();
  useIframeScrollFreeze();
  const {
    setObservedPostElement,
    takePendingSeenPostIds,
    restorePendingSeenPostIds,
  } = useMarkPostSeen(user?.id);

  // Check if the user follows anyone (to differentiate empty state)
  const { data: followingCount } = useQuery({
    queryKey: ['following-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);
      return count ?? 0;
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  // Demo feed for signed-out users
  const { data: demoPostsData, isLoading: demoLoading } = usePosts();

  // Check if followings have any public posts at all (ignoring seen state).
  // If yes but feed is empty → user has caught up on everything.
  const { data: followingHasAnyPosts } = useQuery({
    queryKey: ['following-has-posts', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const ids = (follows ?? []).map((f) => f.following_id);
      ids.push(user.id);
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_public', true)
        .in('user_id', ids);
      return (count ?? 0) > 0;
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  // Following feed for signed-in users
  const {
    items: followingPosts,
    empty: followingEmpty,
    loading: followingLoading,
    loadMore,
    hasMore,
    refresh: refreshFollowingFeed,
  } = useFollowingFeed(user?.id);

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
        likes_count: post.likes_count || 0,
        comments_count: post.comments_count || 0,
        hide_likes: post.profiles?.settings?.hide_likes || false,
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
      feedSortTime: post.reposted_at || post.created_at,
      saves: post.saves_count,
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      reposts_count: post.reposts_count || 0,
      isRealPost: true,
      isRepost: post.is_repost,
      repostedByUsername: post.reposted_by_username,
      media_kind: post.media_kind,
      aspect_ratio: post.aspect_ratio,
      suggested_height: post.suggested_height,
    }));
  }, [followingPosts, showDemoFeed]);

  const allPosts = showDemoFeed ? mappedDemoPosts : feedPosts;

  const { registerItem } = useFeedAnchorRestoration(
    "/",
    useMemo(() => allPosts.map((p) => p.id), [allPosts])
  );

  useEffect(() => {
    if (sessionLoading || user || isDemoMode) return;
    // Guard against a brief flash to /auth before the persisted Supabase
    // session is rehydrated. If a token exists in localStorage, wait for
    // onAuthStateChange to populate the user instead of redirecting.
    let hasStoredToken = false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
          hasStoredToken = true;
          break;
        }
      }
    } catch {
      // ignore
    }
    if (hasStoredToken) return;
    navigate("/auth");
  }, [user, sessionLoading, isDemoMode, navigate]);

  // Mark first render complete to prevent flicker on subsequent renders
  useEffect(() => {
    if (allPosts.length > 0) {
      hasRenderedOnce.current = true;
    }
  }, [allPosts.length]);

  const handleRefresh = useCallback(async () => {
    // Drain pending "seen" marks so the refresh RPC can mark them and
    // surface new posts above them in a single round-trip.
    const drained = takePendingSeenPostIds();
    const countKey = ['following-count', user?.id] as const;
    const hasPostsKey = ['following-has-posts', user?.id] as const;

    try {
      await Promise.all([
        refreshFollowingFeed(drained),
        queryClient.refetchQueries({ queryKey: countKey, exact: true, type: 'active' }),
        queryClient.refetchQueries({ queryKey: hasPostsKey, exact: true, type: 'active' }),
      ]);
    } catch {
      restorePendingSeenPostIds(drained);
    }
  }, [takePendingSeenPostIds, restorePendingSeenPostIds, refreshFollowingFeed, queryClient, user?.id]);

  // Data-friendly invisible pagination: load the next page only when the
  // user reaches a post ~7 items before the end. Uses an IntersectionObserver
  // attached to that specific post so nothing fetches until it's actually
  // needed — and no loader is ever shown.
  const PREFETCH_OFFSET = 7;
  const prefetchTriggerIndex = Math.max(0, allPosts.length - PREFETCH_OFFSET);
  const prefetchSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || showDemoFeed) return;
    const el = prefetchSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: '0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, showDemoFeed, allPosts.length, prefetchTriggerIndex]);

  const loading = showDemoFeed ? demoLoading : followingLoading;
  const shouldShowSkeleton = !hasRenderedOnce.current && allPosts.length === 0 && (sessionLoading || loading);

  return (
    <SwipeableView leftRoute="/saved" rightRoute="/messages" leftLabel="Saved" rightLabel="Messages">
      <div className="min-h-screen bg-background pb-20">
        <Header onCreatePost={() => setIsCreateDialogOpen(true)} />

      <PullToRefresh
        onRefresh={handleRefresh}
      >
        <main className="mx-auto max-w-2xl px-4 py-6 min-h-[calc(100vh-9rem)]">
            {shouldShowSkeleton ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <PostSkeleton key={i} />
                ))}
              </div>
            ) : !showDemoFeed && followingEmpty ? (
            followingCount === undefined || followingHasAnyPosts === undefined ? (
              <div className="py-16" />
            ) : followingCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="text-lg font-semibold">Nothing here yet 👀</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  No algorithm should decide your feed.. only your follows do.
                </p>
                <Link to="/discover" className="text-sm font-medium text-primary">
                  Discover people to follow
                </Link>
              </div>
            ) : followingHasAnyPosts ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-lg font-semibold">You're all caught up</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You've seen all recent posts from people you follow.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-lg font-semibold">No posts yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  People you follow haven't posted anything yet. Check back soon.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-6">
              {allPosts.map((post, index) => (
                <div 
                  key={post.id} 
                  ref={(el) => {
                    registerItem(post.id)(el);
                    if (!showDemoFeed) {
                      setObservedPostElement(post.id, el as HTMLDivElement | null);
                    }
                    if (index === prefetchTriggerIndex) {
                      prefetchSentinelRef.current = el;
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
                <motion.div
                  className="flex flex-col items-center justify-center pt-24 pb-10 text-center"
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                >
                  <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
                  <h3 className="text-lg font-semibold">You're all caught up</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You've seen all recent posts from people you follow.
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </main>
      </PullToRefresh>

        <CreatePostDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      </div>
    </SwipeableView>
  );
};

export default Index;

