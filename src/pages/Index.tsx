import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
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

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIframeScrollFreeze } from "@/hooks/useIframeScrollFreeze";
import { SwipeableView } from "@/components/SwipeableView";
import { markScrolledPast, reorderBySlowness, subscribeEmbedReadiness } from "@/lib/embedReadiness";
import { useFeedWithAds } from "@/hooks/useFeedWithAds";
import { NativeFeedAd } from "@/components/ads/NativeFeedAd";
const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));
  const hasRenderedOnce = useRef(false);
  const queryClient = useQueryClient();
  useIframeScrollFreeze();
  const { observePost } = useMarkPostSeen(user?.id);

  // How many people does this user follow? Used to differentiate the
  // "Nothing here yet" (no follows) vs "No posts yet" (follows have no posts) states.
  const seenFeedStorageKey = user?.id ? `aelixto-has-had-feed:${user.id}` : null;
  const [hasHadFeedPosts, setHasHadFeedPosts] = useState(false);

  useEffect(() => {
    if (!seenFeedStorageKey) {
      setHasHadFeedPosts(false);
      return;
    }
    setHasHadFeedPosts(window.localStorage.getItem(seenFeedStorageKey) === "1");
  }, [seenFeedStorageKey]);

  const { data: followingCount, isLoading: followingCountLoading, isError: followingCountError } = useQuery({
    queryKey: ["my-following-count", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_following_count" as any);
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  // Has the viewer seen any posts? Used to differentiate "no posts yet"
  // (follows haven't posted anything) from "all caught up" (everything seen).
  const { data: hasSeenAnyPosts } = useQuery({
    queryKey: ["has-seen-any-posts", user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("post_seen")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .limit(1);
      return (count ?? 0) > 0;
    },
  });
  
  
  // Demo feed for signed-out users — only fetched when actually shown
  const isDemoModeEnv = import.meta.env.VITE_DEMO_MODE === "true";
  const enableDemoFetch = !user && isDemoModeEnv;
  const { data: demoPostsData, isLoading: demoLoading } = usePosts({ enabled: enableDemoFetch });

  // Following feed for signed-in users
  const {
    items: followingPosts,
    empty: followingEmpty,
    loading: followingLoading,
    loadMore,
    hasMore,
  } = useFollowingFeed();

  const isDemoMode = isDemoModeEnv;
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
        preview_text: post.preview_text,
        preview_title: post.preview_title,
        preview_image_url: post.preview_image_url,
        aspect_ratio: (post as any).aspect_ratio,
        media_kind: (post as any).media_kind,
        suggested_height: (post as any).suggested_height,
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
      preview_text: post.preview_text,
      preview_title: post.preview_title,
      preview_image_url: post.preview_image_url,
      suggested_height: post.suggested_height,
      aspect_ratio: post.aspect_ratio,
      media_kind: post.media_kind,
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

  // Subscribe to embed readiness so the feed reflows when slow posts time out
  // or when previously-slow posts finish loading.
  const [readinessTick, setReadinessTick] = useState(0);
  useEffect(() => subscribeEmbedReadiness(() => setReadinessTick((t) => t + 1)), []);

  // Reordered feed: posts whose embeds are still loading past the slow threshold
  // sink below faster ones, but only for posts the user hasn't already committed
  // to (rendered successfully or scrolled past).
  const displayPosts = useMemo(
    () => reorderBySlowness(allPosts as Array<{ id: string } & Record<string, any>>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPosts, readinessTick]
  ) as typeof allPosts;

  // Mark posts as "scrolled past" so they lock in place and never reshuffle
  // under the user's eyes once they've moved beyond them.
  const pastObserverRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    pastObserverRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-feed-item-id");
          if (!id) continue;
          // boundingClientRect.bottom < 0 means the whole item is above the viewport top.
          if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
            markScrolledPast(id);
          }
        }
      },
      { rootMargin: "0px", threshold: 0 }
    );
    return () => pastObserverRef.current?.disconnect();
  }, []);
  const observeForPast = useCallback((el: HTMLElement | null) => {
    const obs = pastObserverRef.current;
    if (!obs || !el) return;
    obs.observe(el);
  }, []);

  const { registerItem } = useFeedAnchorRestoration(
    "/",
    useMemo(() => displayPosts.map((p) => p.id), [displayPosts])
  );

  // Interleave native ads after every N posts (only for eligible native users).
  const feedWithAds = useFeedWithAds(displayPosts as Array<{ id: string } & Record<string, any>>);

  useEffect(() => {
    if (!sessionLoading && !user && !isDemoMode) {
      navigate("/auth");
    }
  }, [user, sessionLoading, isDemoMode, navigate]);

  // Mark first render complete to prevent flicker on subsequent renders
  useEffect(() => {
    if (allPosts.length > 0) {
      hasRenderedOnce.current = true;
      if (seenFeedStorageKey) {
        window.localStorage.setItem(seenFeedStorageKey, "1");
        setHasHadFeedPosts(true);
        queryClient.setQueryData(["has-seen-any-posts", user?.id], true);
      }
    }
  }, [allPosts.length, queryClient, seenFeedStorageKey, user?.id]);

  const handleRefresh = useCallback(async () => {
    // Collapse the infinite feed back to a single page first. Otherwise every
    // loaded page is refetched sequentially on refresh, which is what makes the
    // spinner feel "stuck" after the user has scrolled a while.
    if (!showDemoFeed) {
      queryClient.setQueryData(["following-feed"], (old: any) =>
        old?.pages?.length > 1
          ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) }
          : old,
      );
    }

    // Only await the primary list; secondary counters refresh in the background
    // so the indicator never waits on them.
    queryClient.invalidateQueries({ queryKey: ["my-following-count", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["has-seen-any-posts", user?.id] });

    await queryClient.refetchQueries({
      queryKey: showDemoFeed ? ["posts"] : ["following-feed"],
      type: "active",
    });
  }, [queryClient, showDemoFeed, user?.id]);

  // Data-friendly invisible pagination: load the next page only when the
  // user reaches a post ~7 items before the end. Uses an IntersectionObserver
  // attached to that specific post so nothing fetches until it's actually
  // needed — and no loader is ever shown.
  const PREFETCH_OFFSET = 7;
  const prefetchTriggerIndex = Math.max(0, displayPosts.length - PREFETCH_OFFSET);
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
  }, [hasMore, loadMore, showDemoFeed, displayPosts.length, prefetchTriggerIndex]);

  // Only show skeleton on truly empty first load - prevent flicker
  const loading = showDemoFeed ? demoLoading : followingLoading;
  const shouldShowSkeleton = !hasRenderedOnce.current && (sessionLoading || loading) && allPosts.length === 0;
  const hasKnownSeenPosts = Boolean(hasSeenAnyPosts || hasHadFeedPosts);
  const shouldWaitForEmptyState =
    !showDemoFeed &&
    followingEmpty &&
    !hasKnownSeenPosts &&
    (followingCountLoading || followingCount === undefined) &&
    !followingCountError;

  if (shouldShowSkeleton || shouldWaitForEmptyState) {
    return (
      <SwipeableView leftRoute="/saved" rightRoute="/messages" leftLabel="Saved" rightLabel="Messages">
        <div className="screen-nav bg-background">
          <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
          <main className="mx-auto max-w-2xl px-4 py-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <PostSkeleton key={i} />
              ))}
            </div>
          </main>
        </div>
      </SwipeableView>
    );
  }

  return (
    <SwipeableView leftRoute="/saved" rightRoute="/messages" leftLabel="Saved" rightLabel="Messages">
      <div className="screen-nav bg-background">
        <Header onCreatePost={() => setIsCreateDialogOpen(true)} />

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="mx-auto max-w-2xl px-4 py-6">
          {!showDemoFeed && followingEmpty ? (
            followingCount === 0 && !hasKnownSeenPosts && !followingCountError ? (
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
            ) : hasKnownSeenPosts ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary mb-3" strokeWidth={1.5} />
                <h2 className="text-xl font-semibold">You're all caught up</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  You've seen all recent posts from people you follow.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <h2 className="text-xl font-semibold">No posts yet</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  The people you follow haven't posted anything yet.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-6">
              {feedWithAds.map((item) => {
                if (item.kind === 'ad') {
                  return <NativeFeedAd key={`ad-${item.slotIndex}`} />;
                }
                const post = item.post as any;
                const index = item.slotIndex;
                return (
                  <div
                    key={post.id}
                    ref={(el) => {
                      registerItem(post.id)(el);
                      if (!showDemoFeed && el) observePost(post.id)(el as HTMLDivElement);
                      if (el) observeForPast(el);
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
                );
              })}
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

        <CreatePostDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      </div>
    </SwipeableView>
  );
};

export default Index;

