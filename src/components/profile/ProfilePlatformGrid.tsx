import { useUserPlatformPosts, PlatformPost } from "@/hooks/useUserPlatformPosts";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Pin } from "lucide-react";
import { getPostThumb, maybeProxy } from "@/lib/getPostThumb";
import { TextCardThumbnail } from "@/components/TextCardThumbnail";
import { getThumbnailText } from "@/lib/getThumbnailText";
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
import { PostOwnerActionsSheet } from "./PostOwnerActionsSheet";

function PostCard({ post, onClick, onLongPress }: { 
  post: PlatformPost; 
  onClick: () => void;
  onLongPress?: () => void;
  eager?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isPinned = !!post.pinned_at;

  // Long-press detection (touch + mouse) — opens the owner actions sheet.
  const longPressTimer = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const startLongPress = () => {
    if (!onLongPress) return;
    suppressClickRef.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      onLongPress();
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onClick();
  };
  const pressProps = onLongPress
    ? {
        onTouchStart: startLongPress,
        onTouchEnd: cancelLongPress,
        onTouchMove: cancelLongPress,
        onTouchCancel: cancelLongPress,
        onMouseDown: startLongPress,
        onMouseUp: cancelLongPress,
        onMouseLeave: cancelLongPress,
        onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); },
      }
    : {};

  const PinBadge = () =>
    isPinned ? (
      <div className="absolute top-2 left-2 z-10 grid place-items-center h-7 w-7 rounded-full bg-black/40 backdrop-blur-sm">
        <Pin className="h-3.5 w-3.5 text-neutral-300 fill-neutral-300" style={{ transform: 'rotate(45deg)' }} />
      </div>
    ) : null;
  
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
  const platform = (post.platform || "").toLowerCase();
  // Prefer the post's own text/title as the thumbnail. Only fall back to the
  // author's profile avatar when the post has no usable copy at all (and even
  // then, never for Reddit — Reddit uses the branded logo card).

  // Smart playable detection: only show the play overlay when we can
  // confidently say this post is a video. media_type alone is unreliable
  // because many platforms (X, Reddit, Threads, LinkedIn, etc.) default
  // image/text posts to "video" when scraped from their iframe wrappers.
  const isPlayable = (() => {
    const url = (post.media_url || "").toLowerCase();
    const mt = (post.media_type || "").toLowerCase();
    const thumb = (rawThumb || "").toLowerCase();
    // Native video platforms — always playable
    if (platform === "youtube" || platform === "tiktok" || platform === "spotify") return true;
    // Direct video file
    if (/\.(mp4|mov|webm|m4v|m3u8)(\?|$)/i.test(url)) return true;
    // URL path hints that strongly imply video content
    if (/\/(video|videos|reel|reels|shorts|watch|clip|clips)\//.test(url)) return true;
    if (/\/v\//.test(url) && (platform === "facebook" || platform === "instagram")) return true;
    // Thumbnail URL hints — twitter/X video posters live at amplify_video_thumb /
    // ext_tw_video_thumb / tweet_video_thumb. Reddit videos use v.redd.it posters.
    if (/video_thumb|amplify_video|ext_tw_video|tweet_video|v\.redd\.it/.test(thumb)) return true;
    // Only trust media_type === 'video' for platforms where it's reliable
    if (mt === "video" && (platform === "facebook" || platform === "instagram")) return true;
    return false;
  })();

  // Show platform-branded fallback when no thumbnail or image error
  if (!src || src === "/placeholder.svg") {
    const textSource = getThumbnailText(post);
    // Threads (like X and Reddit) should always render a branded text card
    // instead of falling back to the author's profile picture.
    const useProfileFallback = false;
    const aspect = getAspectRatio();
    return (
      <button
        onClick={handleClick}
        {...pressProps}
        className={`press-in relative overflow-hidden rounded-2xl ${aspect} block w-full bg-muted/70`}
      >
        <PinBadge />
        <TextCardThumbnail
          platform={post.platform}
          text={textSource}
          username={post.profile_username}
          displayName={post.profile_display_name}
          profileAvatarUrl={post.profile_avatar_url}
          preferProfile={useProfileFallback}
          aspect={aspect}
        />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      {...pressProps}
      className={`press-in relative overflow-hidden rounded-2xl ${getAspectRatio()} block w-full bg-muted/70 group`}
    >
      <PinBadge />
      {!imageLoaded && (
        <div
          className="absolute inset-0 bg-muted/70 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer"
          style={{ backgroundSize: "1000px 100%" }}
        />
      )}
      <img
        src={src}
        alt=""
        onError={() => setImageError(true)}
        onLoad={() => setImageLoaded(true)}
        className={`relative w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
        loading="eager"
        decoding="async"
      />

      {/* Play button overlay for videos */}
      {isPlayable && (
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
  isOwner?: boolean;
  currentUserId?: string;
}

export const ProfilePlatformGrid = ({
  userId,
  activeTab,
  tabs,
  onTabChange,
  isOwner = false,
  currentUserId,
}: ProfilePlatformGridProps) => {
  const { items, loading, hasMore, loadMore } = useUserPlatformPosts(
    userId,
    activeTab
  );
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number>(-1);
  const [actionsPost, setActionsPost] = useState<PlatformPost | null>(null);
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
                  <div key={`${activeTab}-${post.id}`}>
                    <PostCard
                      post={post}
                      onClick={() => handlePostClick(post.id, idx)}
                      onLongPress={
                        isOwner && currentUserId && !post.is_repost
                          ? () => setActionsPost(post)
                          : undefined
                      }
                    />
                  </div>
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

      {actionsPost && currentUserId && (
        <PostOwnerActionsSheet
          open={!!actionsPost}
          onOpenChange={(v) => { if (!v) setActionsPost(null); }}
          postId={actionsPost.id}
          userId={currentUserId}
          platform={actionsPost.platform}
          isPinned={!!actionsPost.pinned_at}
          hideCounts={!!actionsPost.hide_counts}
          commentsDisabled={!!actionsPost.comments_disabled}
          isRepost={!!actionsPost.is_repost}
          currentCaption={actionsPost.content || ""}
        />
      )}
    </>
  );
};
