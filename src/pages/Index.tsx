import { useState, useEffect, useRef } from "react";
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
import { useVirtualizer } from '@tanstack/react-virtual';

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  const parentRef = useRef<HTMLDivElement>(null);
  
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

  // Virtual scrolling for performance
  const rowVirtualizer = useVirtualizer({
    count: allPosts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 600, // Estimated height of each post
    overscan: 2 // Number of items to render outside visible area
  });

  useEffect(() => {
    if (!sessionLoading && !user && !isDemoMode) {
      navigate("/auth");
    }
  }, [user, sessionLoading, isDemoMode, navigate]);

  // Prefetch next posts when user stops scrolling
  useEffect(() => {
    if (showDemoFeed || !hasMore) return;
    
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // If user is near bottom and has stopped scrolling, prefetch
        if (parentRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
          if (scrollHeight - scrollTop - clientHeight < 1000) {
            loadMore();
          }
        }
      }, 150);
    };

    parentRef.current?.addEventListener('scroll', handleScroll);
    return () => {
      clearTimeout(scrollTimeout);
      parentRef.current?.removeEventListener('scroll', handleScroll);
    };
  }, [showDemoFeed, hasMore, loadMore]);

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
      
      <main 
        ref={parentRef}
        className="mx-auto max-w-2xl px-4 py-6 h-[calc(100vh-120px)] overflow-auto"
      >
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
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const post = allPosts[virtualRow.index];
              return (
                <div
                  key={post.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-4"
                >
                  <FeedPost 
                    post={post}
                    userId={user?.id}
                  />
                </div>
              );
            })}
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
