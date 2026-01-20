import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { MemoizedFeedPost as FeedPost } from "@/components/FeedPost";
import { PostSkeleton } from "@/components/PostSkeleton";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { usePosts } from "@/hooks/usePosts";
import { useFollowingFeed } from "@/hooks/useFollowingFeed";
import { useSession } from "@/hooks/useSession";
import { useScrollAheadPreload } from "@/hooks/useScrollAheadPreload";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  
  // Restore scroll position when navigating back
  useScrollRestoration('/');

  // Demo feed for signed-out users
  const { data: demoPostsData, isLoading: demoLoading } = usePosts();

  // Following feed for signed-in users
  const {
    items: followingPosts,
    empty: followingEmpty,
    loading: followingLoading,
  } = useFollowingFeed();

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const isSignedOut = !user;
  const showDemoFeed = isSignedOut && isDemoMode;

  // Map demo posts to feed format
  const mappedDemoPosts = useMemo(() => {
    if (!showDemoFeed) return [];

    return (demoPostsData || [])
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
        isRealPost: true,
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [demoPostsData, showDemoFeed]);

  // Map following posts to feed format
  const feedPosts = useMemo(() => {
    if (showDemoFeed) return [];

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
      isRealPost: true,
      isRepost: post.is_repost,
      repostedByUsername: post.reposted_by_username,
    }));
  }, [followingPosts, showDemoFeed]);

  // Prepare posts for scroll-ahead preloading
  const postsForPreload = useMemo(() => {
    return (showDemoFeed ? mappedDemoPosts : feedPosts).map(post => ({
      profiles: { avatar_url: post.author.avatar },
      thumbnail_url: post.thumbnailUrl,
      media_url: post.mediaUrl,
    }));
  }, [showDemoFeed, mappedDemoPosts, feedPosts]);

  // Scroll-ahead image preloading
  const { registerTrigger } = useScrollAheadPreload(postsForPreload, {
    preloadCount: 5,
    triggerThreshold: 3,
  });

  const allPosts = showDemoFeed ? mappedDemoPosts : feedPosts;

  useEffect(() => {
    if (!sessionLoading && !user && !isDemoMode) {
      navigate("/auth");
    }
  }, [user, sessionLoading, isDemoMode, navigate]);

  // IMPORTANT: keep already-loaded posts visible during navigation.
  // Only show skeleton when we truly have nothing to render yet.
  const loading = showDemoFeed ? demoLoading : followingLoading;
  const shouldShowSkeleton = (sessionLoading || loading) && allPosts.length === 0;

  if (shouldShowSkeleton) {
    return (
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
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />

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
            {allPosts.map((post, index) => (
              <div 
                key={post.id} 
                ref={(el) => registerTrigger(index, el)}
              >
                <FeedPost post={post} userId={user?.id} />
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </div>
  );
};

export default Index;

