import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle } from "lucide-react";
import { deriveThumbnailFromUrl } from "@/lib/deriveThumbnail";

interface PostPreview {
  id: string;
  content: string;
  title: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  preview_image_url: string | null;
  platform: string | null;
  likes_count: number | null;
  comments_count: number | null;
  profile_username: string;
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

interface SharedPostCardProps {
  postId: string;
  isOwn: boolean;
}

export const SharedPostCard = ({ postId, isOwn }: SharedPostCardProps) => {
  const navigate = useNavigate();
  const [post, setPost] = useState<PostPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("id, content, title, media_url, thumbnail_url, preview_image_url, platform, likes_count, comments_count, user_id")
        .eq("id", postId)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("user_id", data.user_id)
        .single();

      setPost({
        ...data,
        profile_username: profile?.username || "unknown",
        profile_display_name: profile?.display_name || null,
        profile_avatar_url: profile?.avatar_url || null,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-60 h-32 rounded-xl bg-muted/50 animate-pulse" />
    );
  }

  if (!post) {
    return (
      <div
        className="w-60 rounded-xl border border-border/50 bg-muted/30 p-3 cursor-pointer"
        onClick={() => navigate(`/post/${postId}`)}
      >
        <p className="text-xs text-muted-foreground">Post unavailable</p>
      </div>
    );
  }

  const imageUrl = post.thumbnail_url || post.preview_image_url || post.media_url;
  const caption = post.title || post.content;

  return (
    <div
      className="w-60 rounded-xl overflow-hidden border border-border/30 cursor-pointer active:scale-[0.98] transition-transform"
      style={{ backgroundColor: isOwn ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))" }}
      onClick={() => navigate(`/post/${postId}`)}
    >
      {/* Image */}
      {imageUrl && (
        <div className="w-full aspect-square bg-black/10 overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Post info */}
      <div className="p-2.5 space-y-1.5">
        {/* Author */}
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarImage src={post.profile_avatar_url || undefined} />
            <AvatarFallback className="text-[8px] bg-muted">
              {post.profile_username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-semibold truncate">
            @{post.profile_username}
          </span>
        </div>

        {/* Caption */}
        {caption && (
          <p className="text-xs line-clamp-2 leading-tight opacity-80">
            {caption}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 pt-0.5">
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Heart className="h-3 w-3" /> {post.likes_count || 0}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <MessageCircle className="h-3 w-3" /> {post.comments_count || 0}
          </span>
        </div>
      </div>
    </div>
  );
};
