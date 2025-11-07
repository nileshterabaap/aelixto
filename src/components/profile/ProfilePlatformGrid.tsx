import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { getPostThumbnail } from "@/lib/thumbnails";
import instagramIcon from "@/assets/instagram-icon.png";
import youtubeIcon from "@/assets/youtube-icon.png";
import redditIcon from "@/assets/reddit-icon.png";
import twitterIcon from "@/assets/twitter-icon.png";
import pinterestIcon from "@/assets/pinterest-icon.png";
import tiktokIcon from "@/assets/tiktok-icon.png";

const PLATFORM_ICONS: Record<string, string> = {
  instagram: instagramIcon,
  youtube: youtubeIcon,
  reddit: redditIcon,
  twitter: twitterIcon,
  x: twitterIcon,
  pinterest: pinterestIcon,
  tiktok: tiktokIcon,
};

function PlatformBadge({ platform }: { platform?: string | null }) {
  const icon = platform ? PLATFORM_ICONS[platform.toLowerCase()] : undefined;
  if (!icon) return null;
  
  return (
    <div className="absolute top-2 right-2 z-10">
      <img
        src={icon}
        alt={platform || ""}
        className="w-8 h-8 rounded-full shadow-md ring-2 ring-white/70 object-cover"
      />
    </div>
  );
}

function PostCard({ post, onClick }: { post: PlatformPost; onClick: () => void }) {
  const [imageError, setImageError] = useState(false);
  const thumbnail = useMemo(() => getPostThumbnail(post), [post]);

  const getAspectRatio = () => {
    if (post.platform === "youtube") return "aspect-video";
    if (post.platform === "instagram" || post.platform === "tiktok") return "aspect-square";
    return "aspect-[4/5]";
  };

  return (
    <button
      onClick={onClick}
      className="relative rounded-3xl overflow-hidden bg-muted group transition-all shadow-sm hover:shadow-md"
    >
      <PlatformBadge platform={post.platform} />
      
      <div className={`${getAspectRatio()} w-full`}>
        {thumbnail && !imageError ? (
          <img
            src={thumbnail}
            alt={post.title || "Post"}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted/40 animate-pulse" />
        )}
      </div>

      {/* Play button overlay for videos */}
      {post.media_type === "video" && (
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
