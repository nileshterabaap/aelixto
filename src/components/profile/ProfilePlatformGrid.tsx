import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { getPostThumb, maybeProxy } from "@/lib/getPostThumb";
import InstagramIcon from "@/assets/platforms/instagram.svg";
import FacebookIcon from "@/assets/platforms/facebook.svg";
import YoutubeIcon from "@/assets/platforms/youtube.svg";
import TiktokIcon from "@/assets/platforms/tiktok.svg";
import XIcon from "@/assets/platforms/x.svg";
import BlogIcon from "@/assets/platforms/blog.svg";
import type { PlatformTab } from "@/hooks/useUserPlatformTabs";
import { PlatformPostViewer } from "./PlatformPostViewer";

function PostCard({ post, onClick }: { 
  post: PlatformPost; 
  onClick: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  
  // YouTube uses 16:9, all others use 3:4 portrait
  const getAspectRatio = () => post.platform === "youtube" ? "aspect-video" : "aspect-[3/4]";

  const getPlatformGradient = () => {
    switch (post.platform) {
      case 'instagram': return 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400';
      case 'facebook': return 'bg-gradient-to-br from-blue-600 to-blue-400';
      case 'youtube': return 'bg-gradient-to-br from-red-600 to-red-400';
      case 'tiktok': return 'bg-gradient-to-br from-black to-gray-800';
      case 'x': return 'bg-black';
      case 'article': return 'bg-gradient-to-br from-emerald-600 to-teal-400';
      default: return 'bg-muted';
    }
  };

  const getPlatformIcon = () => {
    switch (post.platform) {
      case 'instagram': return InstagramIcon;
      case 'facebook': return FacebookIcon;
      case 'youtube': return YoutubeIcon;
      case 'tiktok': return TiktokIcon;
      case 'x': return XIcon;
      case 'article': return BlogIcon;
      default: return null;
    }
  };

  // Try to get thumbnail - prioritize stored thumbnails
  const rawThumb = getPostThumb(post);
  const src = imageError ? null : maybeProxy(rawThumb, 480);
  const Icon = getPlatformIcon();

  // Show platform-branded fallback when no thumbnail or image error
  if (!src || src === "/placeholder.svg") {
    return (
      <button
        onClick={onClick}
        className={`relative overflow-hidden rounded-2xl ${getAspectRatio()} ${getPlatformGradient()} flex items-center justify-center`}
      >
        {Icon && (
          <img src={Icon} alt="" className="w-12 h-12 opacity-60 invert" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl ${getAspectRatio()} bg-muted/50 group`}
    >
      <img
        src={src}
        alt=""
        onError={() => setImageError(true)}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Play button overlay for videos */}
      {post.media_type === "video" && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
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
  tabs: PlatformTab[];
  onTabChange: (tab: string) => void;
}

export const ProfilePlatformGrid = ({
  userId,
  activeTab,
  tabs,
  onTabChange,
}: ProfilePlatformGridProps) => {
  const { items, loading, hasMore, loadMore } = useUserPlatformPosts(
    userId,
    activeTab
  );
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const handlePostClick = (postId: string) => {
    setSelectedPostId(postId);
    setViewerOpen(true);
  };

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
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {items.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4), ease: [0.4, 0, 0.2, 1] }}
            >
              <PostCard
                post={post}
                onClick={() => handlePostClick(post.id)}
              />
            </motion.div>
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

      {viewerOpen && selectedPostId && (
        <PlatformPostViewer
          userId={userId}
          initialPostId={selectedPostId}
          tabs={tabs}
          activeTab={activeTab}
          onClose={() => setViewerOpen(false)}
          onTabChange={(tab) => {
            onTabChange(tab);
          }}
        />
      )}
    </>
  );
};
