import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { getPostThumbnail } from "@/lib/thumbnails";
import { supabase } from "@/integrations/supabase/client";

function PostCard({ post, onClick }: { post: PlatformPost; onClick: () => void }) {
  const [imageError, setImageError] = useState(false);
  const thumbnail = useMemo(() => getPostThumbnail(post), [post]);
  
  // Use image proxy for external URLs
  const proxyUrl = useMemo(() => {
    if (!thumbnail) return null;
    // Skip proxy for Supabase storage URLs
    if (thumbnail.includes('supabase.co') || thumbnail.startsWith('/')) {
      return thumbnail;
    }
    // Use image proxy for external URLs
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/img-proxy?u=${encodeURIComponent(thumbnail)}&w=480`;
  }, [thumbnail]);
  
  // Trigger thumbnail fetch if missing
  useEffect(() => {
    if (!thumbnail && post.media_url && post.platform) {
      console.log(`[ProfilePlatformGrid] Triggering thumbnail fetch for post ${post.id}`);
      supabase.functions.invoke('fetch-post-preview', {
        body: { postId: post.id, url: post.media_url, platform: post.platform }
      }).catch(err => console.error('[ProfilePlatformGrid] Failed to fetch thumbnail:', err));
    }
  }, [post.id, post.media_url, post.platform, thumbnail]);

  const getAspectRatio = () => {
    // Match Feed styling
    if (post.platform === "youtube") return "aspect-video"; // 16:9
    if (post.platform === "instagram" || post.platform === "tiktok") return "aspect-square"; // 1:1
    if (post.platform === "reddit" || post.platform === "quora" || post.platform === "medium") return "aspect-[4/3]";
    return "aspect-[4/5]"; // Default for other platforms
  };

  return (
    <button
      onClick={onClick}
      className="relative rounded-3xl overflow-hidden bg-muted group transition-all shadow-sm hover:shadow-md"
    >
      <div className={`${getAspectRatio()} w-full bg-muted/60`}>
        {proxyUrl && !imageError ? (
          <img
            src={proxyUrl}
            alt={post.title || "Post"}
            onError={(e) => {
              console.error("Image failed to load:", proxyUrl);
              setImageError(true);
            }}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/80 to-muted/40" />
        )}
      </div>

      {/* Play button overlay for videos */}
      {post.media_type === "video" && proxyUrl && !imageError && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm grid place-items-center">
            <div className="w-0 h-0 border-l-[14px] border-l-white border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1" />
          </div>
        </div>
      )}
    </button>
  );
}

interface ProfilePlatformGridProps {
  userId: string;
  activeTab: string;
}

export const ProfilePlatformGrid = ({
  userId,
  activeTab,
}: ProfilePlatformGridProps) => {
  const { items, loading, hasMore, loadMore } = useUserPlatformPosts(
    userId,
    activeTab
  );
  const navigate = useNavigate();

  if (loading && items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Loading posts...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted-foreground">
          No posts to show yet for this filter.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
        {items.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onClick={() => navigate(`/post/${post.id}`)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={loadMore}
            disabled={loading}
            variant="outline"
            className="rounded-full"
          >
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
};
