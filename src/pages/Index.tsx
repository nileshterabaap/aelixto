import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { FeedPost } from "@/components/FeedPost";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { usePosts } from "@/hooks/usePosts";

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: userPosts, isLoading: postsLoading } = usePosts();

  // Map user posts to the feed format
  const allPosts = (userPosts || []).map(post => ({
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
    platform: post.platform as "youtube" | "instagram" | "tiktok" | "reddit" | "twitter" | "pinterest",
    embed_html: post.embed_html,
    timestamp: new Date(post.created_at),
    saves: post.saves_count,
    isRealPost: true,
  })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading || postsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-4">
          {allPosts.map((post) => (
            <FeedPost 
              key={post.id} 
              post={post}
              userId={user?.id}
            />
          ))}
        </div>
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
