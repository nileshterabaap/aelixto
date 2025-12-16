import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { MemoizedFeedPost as FeedPost } from "@/components/FeedPost";
import { PostSkeleton } from "@/components/PostSkeleton";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { usePosts } from "@/hooks/usePosts";
import { useFollowingFeed } from "@/hooks/useFollowingFeed";
import { useSession } from "@/hooks/useSession";

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  
  // Demo feed for signed-out users
  const { data: demoPostsData, isLoading: demoLoading } = usePosts();
  
  // Following feed for signed-in users
  const { 
    items: followingPosts, 
    empty: followingEmpty, 
    loading: followingLoading,
    loadMore,
    hasMore 
  } = useFollowingFeed();

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const isSignedOut = !user;
  const showDemoFeed = isSignedOut && isDemoMode;

  // Map demo posts to feed format
  const mappedDemoPosts = showDemoFeed ? (demoPostsData || []).map(post => ({
    id: post.id,
    user_id: post.user_id,
    author: {
      name: post.profiles?.username || "Anonymous",
      username: `@${post.profiles?.username || "anonymous"}`,
      avatar: post.profiles?.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
    },
    title: post.title || "",
    content: post.content,
    mediaType: post.media_type as "image" | "video" | "none",
    mediaUrl: post.media_url || undefined,
    thumbnailUrl: post.thumbnail_url || undefined,
    platform: post.platform as "youtube" | "instagram" | "tiktok" | "reddit" | "twitter" | "pinterest",
    embed_html: post.embed_html,
    timestamp: new Date(post.created_at),
    saves: post.saves_count,
    isRealPost: true,
  })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) : [];

  // Map following posts to feed format
  const feedPosts = !showDemoFeed ? followingPosts.map(post => ({
    id: post.id,
    user_id: post.user_id,
    author: {
      name: post.profiles?.username || "Anonymous",
      username: `@${post.profiles?.username || "anonymous"}`,
      avatar: post.profiles?.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
    },
    title: post.title || "",
    content: post.content,
    mediaType: post.media_type as "image" | "video" | "none",
    mediaUrl: post.media_url || undefined,
    thumbnailUrl: post.thumbnail_url || undefined,
    platform: post.platform as "youtube" | "instagram" | "tiktok" | "reddit" | "twitter" | "pinterest",
    embed_html: post.embed_html,
    timestamp: new Date(post.created_at),
    saves: post.saves_count,
    isRealPost: true,
    isRepost: post.is_repost,
    repostedByUsername: post.reposted_by_username,
  })) : [];

  const allPosts = showDemoFeed ? mappedDemoPosts : feedPosts;

  useEffect(() => {
    if (!sessionLoading && !user && !isDemoMode) {
      navigate("/auth");
    }
  }, [user, sessionLoading, isDemoMode, navigate]);

  const loading = showDemoFeed ? demoLoading : followingLoading;

  if (sessionLoading || loading) {
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
            <a
              href="/discover"
              className="mt-4 px-4 py-2 rounded-full border border-foreground/30 hover:bg-foreground hover:text-background transition-all"
            >
              Discover people to follow
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {allPosts.map((post) => (
              <FeedPost key={post.id} post={post} userId={user?.id} />
            ))}
          </div>
        )}
      </main>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Index;
