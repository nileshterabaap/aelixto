import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { FeedPost } from "@/components/FeedPost";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CreatePostDialog } from "@/components/CreatePostDialog";

export default function SavedPosts() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [createPostOpen, setCreatePostOpen] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  const { data: savedPosts = [], isLoading } = useQuery({
    queryKey: ["saved-posts", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from("saves")
        .select(`
          post_id,
          posts (
            id,
            user_id,
            content,
            created_at,
            likes_count,
            saves_count,
            comments_count,
            reposts_count,
            media_type,
            media_url,
            platform,
            embed_html,
            thumbnail_url,
            title,
            is_public,
            profiles:user_id (
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data
        .filter((item) => item.posts)
        .map((item: any) => {
          const post = item.posts;
          const profile = post.profiles;
          
          return {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            title: post.title || "",
            mediaType: post.media_type,
            mediaUrl: post.media_url,
            platform: post.platform,
            embed_html: post.embed_html,
            thumbnail_url: post.thumbnail_url,
            timestamp: new Date(post.created_at),
            likes: post.likes_count || 0,
            comments: post.comments_count || 0,
            shares: post.reposts_count || 0,
            saves: post.saves_count || 0,
            author: {
              name: profile?.display_name || profile?.username || "Unknown",
              username: profile?.username || "Unknown",
              avatar: profile?.avatar_url || "/placeholder.svg",
            },
            isRealPost: true,
          };
        });
    },
    enabled: !!session?.user?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading saved posts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Header onCreatePost={() => setCreatePostOpen(true)} />
      
      <main className="container max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Saved Posts</h1>
        
        {savedPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-2">No saved posts yet</p>
            <p className="text-sm text-muted-foreground">
              Save posts to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedPosts.map((post) => (
              <FeedPost key={post.id} post={post} userId={session?.user?.id} />
            ))}
          </div>
        )}
      </main>

      <BottomNav onCreatePost={() => setCreatePostOpen(true)} />
      <CreatePostDialog open={createPostOpen} onOpenChange={setCreatePostOpen} />
    </div>
  );
}
