import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { getPostThumb, maybeProxy } from "@/lib/getPostThumb";

function PostCard({ post, onClick }: { post: PlatformPost; onClick: () => void }) {
  const [imageError, setImageError] = useState(false);
  const rawThumb = getPostThumb(post);
  const src = maybeProxy(rawThumb, 480);

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
      className={`relative overflow-hidden rounded-2xl ${getAspectRatio()} bg-muted`}
    >
      <img
        src={src}
        alt={post.title || "Post"}
        onError={() => setImageError(true)}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Play button overlay for videos */}
      {post.media_type === "video" && !imageError && (
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
      <div className="px-6 py-16 text-center text-muted-foreground">
        No posts yet from {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}.
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
