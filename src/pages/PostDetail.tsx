import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { markPostSeenImmediate } from "@/hooks/useMarkPostSeen";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { HydratedFeedPost } from "@/components/HydratedFeedPost";
import type { Post } from "@/data/demoData";
import { AuthCTABar } from "@/components/AuthCTABar";
import { CommentsDialog } from "@/components/CommentsDialog";

interface SupabasePost {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  saves_count: number;
  comments_count: number;
  media_type: string | null;
  media_url: string | null;
  platform: string | null;
  embed_html: string | null;
  thumbnail_url: string | null;
  title: string | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusCommentId = searchParams.get("comment");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
      // Mark this post as seen when viewing it
      if (user?.id && postId) {
        markPostSeenImmediate(user.id, postId);
      }
    };
    getUser();
    
    if (postId) {
      fetchPost();
    }
  }, [postId]);

  useEffect(() => {
    if (focusCommentId && post) setCommentsOpen(true);
  }, [focusCommentId, post]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("id", postId)
        .single();

      if (error) throw error;
      
      const supabasePost = data as unknown as SupabasePost;
      
      // Transform Supabase post to match FeedPost expected format
      // Spread ALL raw DB columns so renderers can access fields like
      // raw_json_data, preview_title, preview_image_url, preview_text, etc.
      const transformedPost: Post & { isRealPost: boolean; user_id: string } = {
        ...(data as any), // preserve every raw column for renderer access
        id: supabasePost.id,
        user_id: supabasePost.user_id,
        author: {
          name: supabasePost.profiles.display_name || supabasePost.profiles.username,
          username: supabasePost.profiles.username,
          avatar: supabasePost.profiles.avatar_url || '',
        },
        title: supabasePost.title || '',
        content: supabasePost.content,
        mediaType: (supabasePost.media_type as 'image' | 'video') || 'none',
        mediaUrl: supabasePost.media_url || undefined,
        thumbnailUrl: supabasePost.thumbnail_url || undefined,
        platform: supabasePost.platform as any,
        embed_html: supabasePost.embed_html,
        timestamp: new Date(supabasePost.created_at),
        saves: supabasePost.saves_count,
        likes_count: supabasePost.likes_count,
        comments_count: supabasePost.comments_count,
        reposts_count: (data as any).reposts_count ?? 0,
        isRealPost: true,
      };
      
      setPost(transformedPost);
    } catch (error) {
      console.error("Error fetching post:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading post...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Post not found</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Post</h1>
        </div>
      </div>

      <main className={`mx-auto max-w-2xl px-4 py-6 ${!userId ? "pb-32" : ""}`}>
        <HydratedFeedPost post={post} userId={userId} startHydrated />
      </main>
      {!userId && <AuthCTABar />}
      <CommentsDialog
        open={commentsOpen}
        onOpenChange={(o) => {
          setCommentsOpen(o);
          if (!o && focusCommentId) {
            searchParams.delete("comment");
            setSearchParams(searchParams, { replace: true });
          }
        }}
        postId={post.id}
        postAuthorId={(post as any).user_id}
        highlightCommentId={focusCommentId}
      />
    </div>
  );
};

export default PostDetail;
