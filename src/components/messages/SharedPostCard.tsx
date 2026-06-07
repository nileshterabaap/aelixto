import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { deriveThumbnailFromUrl } from "@/lib/deriveThumbnail";
import { getThumbnailText } from "@/lib/getThumbnailText";
import { getPostThumb } from "@/lib/getPostThumb";
import { TextCardThumbnail } from "@/components/TextCardThumbnail";

interface PostPreview {
  id: string;
  media_url: string | null;
  thumbnail_url: string | null;
  preview_image_url: string | null;
  platform: string | null;
  profile_username: string;
  profile_display_name: string | null;
  profile_avatar_url: string | null;
  title: string | null;
  content: string | null;
  embed_html: string | null;
  preview_title: string | null;
  preview_text: string | null;
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
        .select("id, media_url, thumbnail_url, preview_image_url, platform, user_id, title, content, embed_html, preview_title, preview_text")
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

  const rawThumb =
    getPostThumb({
      platform: post.platform,
      thumbnail_url: post.thumbnail_url,
      preview_image_url: post.preview_image_url,
      media_url: post.media_url,
      profile_avatar_url: post.profile_avatar_url,
    }) ||
    post.preview_image_url ||
    deriveThumbnailFromUrl(post.media_url, post.platform);
  const imageUrl = rawThumb || null;
  const textSource = getThumbnailText(post);
  const platformKey = (post.platform || "").toLowerCase();
  const useProfileFallback =
    !imageUrl && !textSource && ["threads", "x", "twitter"].includes(platformKey);

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
      ) : (
        <div className="w-full aspect-square overflow-hidden">
          <TextCardThumbnail
            platform={post.platform}
            text={textSource}
            username={post.profile_username}
            displayName={post.profile_display_name}
            profileAvatarUrl={post.profile_avatar_url}
            preferProfile={useProfileFallback}
            aspect="aspect-square"
          />
        </div>
      )}
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-semibold text-foreground">@{post.profile_username}</span>
        </p>
      </div>
    </div>
  );
};
