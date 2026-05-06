import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { deriveThumbnailFromUrl } from "@/lib/deriveThumbnail";

interface PostPreview {
  id: string;
  media_url: string | null;
  thumbnail_url: string | null;
  preview_image_url: string | null;
  platform: string | null;
  profile_username: string;
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
        .select("id, media_url, thumbnail_url, preview_image_url, platform, user_id")
        .eq("id", postId)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", data.user_id)
        .single();

      setPost({
        ...data,
        profile_username: profile?.username || "unknown",
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-56 h-72 rounded-xl bg-muted/50 animate-pulse" />
    );
  }

  if (!post) {
    return (
      <div
        className="w-56 rounded-xl border border-border/50 bg-muted/30 p-3 cursor-pointer"
        onClick={() => navigate(`/post/${postId}`)}
      >
        <p className="text-xs text-muted-foreground">Post unavailable</p>
      </div>
    );
  }

  const imageUrl = post.thumbnail_url || post.preview_image_url || deriveThumbnailFromUrl(post.media_url, post.platform) || null;

  return (
    <div
      className="w-56 rounded-xl overflow-hidden border border-border/30 cursor-pointer active:scale-[0.98] transition-transform"
      style={{ backgroundColor: isOwn ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))" }}
      onClick={() => navigate(`/post/${postId}`)}
    >
      {imageUrl ? (
        <div className="w-full aspect-square bg-black/10 overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground truncate">
          Sent a post by <span className="font-semibold text-foreground">@{post.profile_username}</span>
        </p>
      </div>
    </div>
  );
};
