import { useUserPlatformPosts } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          No posts to show yet for this filter.
        </p>
      </div>
    );
  }

  // Determine aspect ratio based on platform
  const getAspectRatio = () => {
    if (activeTab === "tiktok" || activeTab === "instagram") {
      return "aspect-square";
    }
    if (activeTab === "youtube") {
      return "aspect-video";
    }
    return "aspect-square";
  };

  const aspectRatio = getAspectRatio();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((post) => (
          <div
            key={post.id}
            onClick={() => navigate(`/post/${post.id}`)}
            className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted"
          >
            <div className={`${aspectRatio} w-full relative`}>
              {post.thumbnail_url ? (
                <img
                  src={post.thumbnail_url}
                  alt={post.title || "Post"}
                  className="w-full h-full object-cover"
                />
              ) : post.media_url ? (
                <img
                  src={post.media_url}
                  alt={post.title || "Post"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <p className="text-xs text-muted-foreground text-center px-2">
                    {post.title || post.content}
                  </p>
                </div>
              )}
              
              {/* Platform glyph */}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5">
                <span className="text-white text-xs font-bold">
                  {activeTab === "youtube" && "▶"}
                  {activeTab === "instagram" && "📷"}
                  {(activeTab === "x" || activeTab === "twitter") && "𝕏"}
                  {activeTab === "reddit" && "👽"}
                  {activeTab === "pinterest" && "📌"}
                  {activeTab === "tiktok" && "🎵"}
                  {!["youtube", "instagram", "x", "twitter", "reddit", "pinterest", "tiktok"].includes(activeTab) && "🔗"}
                </span>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-white text-center px-2">
                  <p className="text-xs font-medium">
                    ❤️ {post.likes_count} · 💾 {post.saves_count}
                  </p>
                </div>
              </div>
            </div>
          </div>
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
