import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getPostThumb, maybeProxy } from "@/lib/getPostThumb";
import { TextCardThumbnail } from "@/components/TextCardThumbnail";
import InstagramIcon from "@/assets/platforms/instagram.svg";
import FacebookIcon from "@/assets/platforms/facebook.svg";
import YoutubeIcon from "@/assets/platforms/youtube.svg";
import TiktokIcon from "@/assets/platforms/tiktok.svg";
import XIcon from "@/assets/platforms/x.svg";
import BlogIcon from "@/assets/platforms/blog.svg";
import ThreadsIcon from "@/assets/platforms/threads.svg";
import RedditIcon from "@/assets/platforms/reddit.svg";
import PinterestIcon from "@/assets/platforms/pinterest.svg";
import SpotifyIcon from "@/assets/platforms/spotify.svg";
import LinkedinIcon from "@/assets/platforms/linkedin.svg";
import QuoraIcon from "@/assets/platforms/quora.svg";
import ExternalIcon from "@/assets/platforms/external.svg";
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
      case 'twitter': return 'bg-black';
      case 'threads': return 'bg-gradient-to-br from-neutral-900 to-neutral-700';
      case 'reddit': return 'bg-gradient-to-br from-orange-600 to-orange-400';
      case 'pinterest': return 'bg-gradient-to-br from-red-700 to-red-500';
      case 'spotify': return 'bg-gradient-to-br from-green-600 to-green-400';
      case 'linkedin': return 'bg-gradient-to-br from-blue-700 to-blue-500';
      case 'quora': return 'bg-gradient-to-br from-red-800 to-red-600';
      case 'article': return 'bg-gradient-to-br from-emerald-600 to-teal-400';
      default: return 'bg-gradient-to-br from-slate-600 to-slate-400';
    }
  };

  const getPlatformIcon = () => {
    switch (post.platform) {
      case 'instagram': return InstagramIcon;
      case 'facebook': return FacebookIcon;
      case 'youtube': return YoutubeIcon;
      case 'tiktok': return TiktokIcon;
      case 'x': return XIcon;
      case 'twitter': return XIcon;
      case 'threads': return ThreadsIcon;
      case 'reddit': return RedditIcon;
      case 'pinterest': return PinterestIcon;
      case 'spotify': return SpotifyIcon;
      case 'linkedin': return LinkedinIcon;
      case 'quora': return QuoraIcon;
      case 'article': return BlogIcon;
      default: return ExternalIcon;
    }
  };

  // Try to get thumbnail - prioritize stored thumbnails
  const rawThumb = getPostThumb(post);
  const src = imageError ? null : maybeProxy(rawThumb, 480);
  const Icon = getPlatformIcon();

  // Show platform-branded fallback when no thumbnail or image error
  if (!src || src === "/placeholder.svg") {
    const textSource =
      (post as any).content?.trim?.() ||
      (post as any).title?.trim?.() ||
      "";
    const aspect = getAspectRatio();
    return (
      <button
        onClick={onClick}
        className={`relative overflow-hidden rounded-2xl ${aspect} block`}
      >
        <TextCardThumbnail
          platform={post.platform}
          text={textSource}
          aspect={aspect}
        />
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
  const [selectedPostIndex, setSelectedPostIndex] = useState<number>(-1);
  const location = useLocation();

  // Close the viewer when the route/location changes (e.g. user taps a nav button)
  useEffect(() => {
    if (viewerOpen) setViewerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.key]);

  // Push a history entry when the viewer opens so the hardware/browser back
  // button closes the overlay instead of leaving the profile page.
  useEffect(() => {
    if (!viewerOpen) return;
    window.history.pushState({ viewer: true }, "");
    const onPop = () => setViewerOpen(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [viewerOpen]);

  const closeViewer = () => {
    setViewerOpen(false);
    if (window.history.state?.viewer) {
      window.history.back();
    }
  };

  const handlePostClick = (postId: string, postIndex: number) => {
    setSelectedPostId(postId);
    setSelectedPostIndex(postIndex);
    setViewerOpen(true);
  };

  const isInitialLoading = loading && items.length === 0;

  // Hold skeletons visible for a small minimum time so a slow network
  // doesn't flash skeleton -> empty -> grid in rapid succession when
  // switching tabs. Premium feel: skeleton resolves into content.
  const [showSkeleton, setShowSkeleton] = useState(isInitialLoading);
  const skeletonShownAtRef = useRef<number>(0);

  useEffect(() => {
    if (isInitialLoading) {
      setShowSkeleton(true);
      skeletonShownAtRef.current = Date.now();
      return;
    }
    // Ensure skeleton stays visible at least 320ms for a smooth resolve
    const elapsed = Date.now() - skeletonShownAtRef.current;
    const remaining = Math.max(0, 320 - elapsed);
    const t = setTimeout(() => setShowSkeleton(false), remaining);
    return () => clearTimeout(t);
  }, [isInitialLoading, activeTab]);

  // Reset skeleton instantly when tab changes so we never flash the
  // previous tab's content during the swap.
  useEffect(() => {
    if (loading) {
      setShowSkeleton(true);
      skeletonShownAtRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const viewKey = showSkeleton
    ? `${activeTab}-loading`
    : items.length === 0
    ? `${activeTab}-empty`
    : `${activeTab}-grid`;

  return (
    <>
      <div className="space-y-4 relative">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={viewKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {showSkeleton ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] rounded-2xl relative overflow-hidden bg-muted/70 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer"
                    style={{ backgroundSize: "1000px 100%" }}
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-16 text-center text-muted-foreground">
                No posts yet from{" "}
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {items.map((post, idx) => (
                  <motion.div
                    key={`${activeTab}-${post.id}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.35,
                      delay: Math.min(idx, 8) * 0.035,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <PostCard
                      post={post}
                      onClick={() => handlePostClick(post.id, idx)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {hasMore && !isInitialLoading && items.length > 0 && (
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
          posts={items}
          loading={loading}
          initialPostId={selectedPostId}
          initialPostIndex={selectedPostIndex}
          tabs={tabs}
          activeTab={activeTab}
          onClose={closeViewer}
          onTabChange={(tab) => {
            onTabChange(tab);
          }}
        />
      )}
    </>
  );
};
