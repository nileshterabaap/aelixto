import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { getPostThumbnail } from "@/lib/thumbnails";
import instagramIcon from "@/assets/platforms/instagram.svg";
import youtubeIcon from "@/assets/platforms/youtube.svg";
import redditIcon from "@/assets/platforms/reddit.svg";
import xIcon from "@/assets/platforms/x.svg";
import pinterestIcon from "@/assets/platforms/pinterest.svg";
import tiktokIcon from "@/assets/platforms/tiktok.svg";
import facebookIcon from "@/assets/platforms/facebook.svg";
import quoraIcon from "@/assets/platforms/quora.svg";
import spotifyIcon from "@/assets/platforms/spotify.svg";
import mediumIcon from "@/assets/platforms/medium.svg";
import blogIcon from "@/assets/platforms/blog.svg";

const PLATFORM_ICONS: Record<string, string> = {
  instagram: instagramIcon,
  youtube: youtubeIcon,
  reddit: redditIcon,
  twitter: xIcon,
  x: xIcon,
  pinterest: pinterestIcon,
  tiktok: tiktokIcon,
  facebook: facebookIcon,
  quora: quoraIcon,
  spotify: spotifyIcon,
  medium: mediumIcon,
  blog: blogIcon,
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

  // Log for debugging if no thumbnail is found
  if (!thumbnail) {
    console.log("No thumbnail for post:", { 
      id: post.id, 
      platform: post.platform,
      thumbnail_url: post.thumbnail_url,
      media_url: post.media_url,
      media_type: post.media_type
    });
  }

  return (
    <button
      onClick={onClick}
      className="relative rounded-3xl overflow-hidden bg-muted group transition-all shadow-sm hover:shadow-md"
    >
      <div className={`${getAspectRatio()} w-full bg-muted/60`}>
        {thumbnail && !imageError ? (
          <img
            src={thumbnail}
            alt={post.title || "Post"}
            onError={(e) => {
              console.error("Image failed to load:", thumbnail);
              setImageError(true);
            }}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center">
            <p className="text-xs text-muted-foreground px-2 text-center">
              {post.title || "No preview available"}
            </p>
          </div>
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
