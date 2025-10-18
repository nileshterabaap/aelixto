import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { FeedPost } from "@/components/FeedPost";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { usePosts } from "@/hooks/usePosts";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { data: posts, isLoading: postsLoading } = usePosts();

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

  const handleSavePost = (postId: string) => {
    toast({
      title: "Post saved!",
      description: "Added to your saved collection"
    });
  };

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
        {posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <FeedPost 
                key={post.id} 
                post={{
                  id: post.id,
                  author: {
                    name: post.profiles?.username || "Anonymous",
                    username: `@${post.profiles?.username || "anonymous"}`,
                    avatar: post.profiles?.avatar_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
                  },
                  content: post.content,
                  mediaType: post.media_type as "image" | "video" | null,
                  mediaUrl: post.media_url || undefined,
                  platform: post.platform as "youtube" | "instagram" | "tiktok" | "reddit" | null,
                  timestamp: new Date(post.created_at).toLocaleString(),
                  savesCount: post.saves_count,
                }} 
                onSave={handleSavePost} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No posts yet. Be the first to create one!</p>
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
