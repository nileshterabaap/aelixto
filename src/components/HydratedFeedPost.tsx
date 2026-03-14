import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreVertical, Trash2, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Post } from "@/data/demoData";
import { useState, useRef, memo, useCallback, useEffect, useMemo } from "react";
import { useScrollVelocity } from "@/hooks/useScrollVelocity";
import { useMediaPauseOnScroll } from "@/hooks/useMediaPauseOnScroll";
import { usePostActions } from "@/hooks/usePostActions";
import { useRepost } from "@/hooks/useReposts";
import { CommentsDialog } from "@/components/CommentsDialog";
import { SaveToCollectionSheet } from "@/components/saved/SaveToCollectionSheet";
import { CollapsibleCaption } from "@/components/CollapsibleCaption";
import { UsernameLink } from "@/components/UsernameLink";
import youtubeIcon from "@/assets/platforms/youtube.svg";
import instagramIcon from "@/assets/platforms/instagram.svg";
import tiktokIcon from "@/assets/platforms/tiktok.svg";
import redditIcon from "@/assets/platforms/reddit.svg";
import twitterIcon from "@/assets/platforms/x.svg";
import pinterestIcon from "@/assets/platforms/pinterest.svg";
import facebookIcon from "@/assets/platforms/facebook.svg";
import quoraIcon from "@/assets/platforms/quora.svg";
import spotifyIcon from "@/assets/platforms/spotify.svg";
import mediumIcon from "@/assets/platforms/medium.svg";
import threadsIcon from "@/assets/platforms/threads.svg";
import linkedinIcon from "@/assets/platforms/linkedin.svg";
import { HydratedEmbed } from "@/components/HydratedEmbed";
import { deriveThumbnailFromUrl } from "@/lib/deriveThumbnail";
import { resolveRenderer } from "@/lib/resolveRenderer";

interface HydratedFeedPostProps {
  post: Post & { isRealPost?: boolean; isRepost?: boolean; repostedByUsername?: string };
  userId?: string;
  isActive?: boolean; // Controlled by parent - whether this post is near viewport
  startHydrated?: boolean; // Skip IntersectionObserver, hydrate immediately
}

const formatTimestamp = (date: Date) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getPlatformIcon = (platform?: string) => {
  if (!platform) return null;
  
  const icons: Record<string, { name: string; icon: string }> = {
    youtube: { name: 'YouTube', icon: youtubeIcon },
    tiktok: { name: 'TikTok', icon: tiktokIcon },
    instagram: { name: 'Instagram', icon: instagramIcon },
    reddit: { name: 'Reddit', icon: redditIcon },
    twitter: { name: 'X', icon: twitterIcon },
    x: { name: 'X', icon: twitterIcon },
    pinterest: { name: 'Pinterest', icon: pinterestIcon },
    facebook: { name: 'Facebook', icon: facebookIcon },
    spotify: { name: 'Spotify', icon: spotifyIcon },
    quora: { name: 'Quora', icon: quoraIcon },
    medium: { name: 'Medium', icon: mediumIcon },
    threads: { name: 'Threads', icon: threadsIcon },
    linkedin: { name: 'LinkedIn', icon: linkedinIcon },
  };
  
  return icons[platform] || null;
};

const detectPlatformFromUrl = (url?: string) => {
  if (!url) return null;
  if (url.includes('spotify.com')) return 'spotify';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.me')) return 'facebook';
  if (url.includes('threads.net') || url.includes('threads.com')) return 'threads';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('tiktok.com')) return 'tiktok';
  return null;
};

export const HydratedFeedPost = ({ post, userId, isActive = true, startHydrated = false }: HydratedFeedPostProps) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(startHydrated);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [repostAnimating, setRepostAnimating] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const { isScrollingFast, velocity } = useScrollVelocity();
  const hydrationResumeTimer = useRef<number | null>(null);

  // Track if embed is within viewport proximity (conservative 400px)
  // Default to true so posts hydrate immediately on mount — IO corrects for off-screen posts
  const [isNearViewport, setIsNearViewport] = useState(true);

  useEffect(() => {
    if (startHydrated) return;
    const el = embedRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(entry.isIntersecting);
      },
      { rootMargin: '2000px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startHydrated]);

  // Gate hydration: hydrate when near viewport, suppress only during active fast scrolling.
  // On idle / initial load, hydrate immediately (no debounce needed).
  useEffect(() => {
    if (isHydrated || !isNearViewport) return;

    // Only suppress during *active* fast scrolling
    if (isScrollingFast) {
      // Clear any pending hydration timer
      if (hydrationResumeTimer.current) {
        clearTimeout(hydrationResumeTimer.current);
        hydrationResumeTimer.current = null;
      }
      return;
    }

    // If user is idle (direction === 'idle' or velocity === 0), hydrate immediately
    if (velocity === 0) {
      setIsHydrated(true);
      return;
    }

    // User is scrolling slowly — hydrate quickly
    hydrationResumeTimer.current = window.setTimeout(() => {
      setIsHydrated(true);
    }, 60);

    return () => {
      if (hydrationResumeTimer.current) {
        clearTimeout(hydrationResumeTimer.current);
      }
    };
  }, [isNearViewport, isScrollingFast, isHydrated, velocity]);

  // Once hydrated, stay hydrated - prevents expensive re-initialization on scroll back
  
  // Normalize field access
  const thumbnailUrl = post.thumbnailUrl || (post as any).thumbnail_url;
  const previewImageUrl = (post as any).preview_image_url;
  const mediaUrl = post.mediaUrl || (post as any).media_url;
  
  // Detect platform
  const detectedPlatform = post.platform || detectPlatformFromUrl(mediaUrl);
  const platform = getPlatformIcon(detectedPlatform);
  
  // Always call hooks unconditionally
  const postActionsResult = usePostActions(post.id, userId || '');
  const repostActionsResult = useRepost(post.id, userId || '');
  
  const canUseActions = post.isRealPost && !!userId;
  
  const postActions = canUseActions 
    ? postActionsResult
    : { 
        isLiked: false, 
        isSaved: false, 
        toggleLike: () => {}, 
        toggleSave: () => {}, 
        handleShare: () => {}, 
        deletePost: () => {},
        isDeleting: false 
      };

  const repostActions = canUseActions
    ? repostActionsResult
    : { isReposted: false, toggleRepost: () => {}, isReposting: false };

  const { isLiked, isSaved, toggleLike, toggleSave, handleShare, deletePost, isDeleting } = postActions;
  const { isReposted, toggleRepost } = repostActions;

  const handleLikeClick = useCallback(() => {
    if (!canUseActions) return;
    setLikeAnimating(true);
    toggleLike();
    setTimeout(() => setLikeAnimating(false), 400);
  }, [canUseActions, toggleLike]);

  const handleRepostClick = useCallback(() => {
    if (!canUseActions) return;
    setRepostAnimating(true);
    toggleRepost();
    setTimeout(() => setRepostAnimating(false), 500);
  }, [canUseActions, toggleRepost]);

  const handlePlayClick = useCallback(() => {
    setIsHydrated(true);
  }, []);

  // Resolve the embed type for rendering
  const r = resolveRenderer(post);
  useMediaPauseOnScroll(
    embedRef,
    `${post.id}:${isHydrated ? 'hydrated' : 'placeholder'}:${r.kind}`
  );
  
  // Derive thumbnail: prefer stored, then derive from URL
  const effectiveThumbnail = thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform);

  return (
    <Card className="overflow-hidden border border-border rounded-xl">
      {/* Repost Indicator */}
      {post.isRepost && post.repostedByUsername && (
        <div className="flex items-center gap-2 px-5 pt-4 text-sm text-muted-foreground">
          <Repeat2 className="w-4 h-4" />
          <span>Reposted by <UsernameLink username={post.repostedByUsername} className="font-semibold text-foreground">@{post.repostedByUsername}</UsernameLink></span>
        </div>
      )}
      
      {/* Standardized Header: avatar, bold username, timestamp + platform icon top-right */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full overflow-hidden bg-muted">
          <img 
            src={post.author.avatar} 
            alt={post.author.username}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        </div>
        <div className="flex-1 min-w-0">
          <UsernameLink username={post.author.username} className="font-bold text-base block leading-tight">
            {post.author.name || post.author.username.replace('@', '')}
          </UsernameLink>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <span>{formatTimestamp(post.timestamp)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-foreground">
          {platform && (
            <img 
              src={platform.icon} 
              alt={platform.name}
              className={`object-contain ${detectedPlatform === 'threads' ? 'w-5 h-5' : detectedPlatform === 'facebook' || detectedPlatform === 'quora' || detectedPlatform === 'spotify' ? 'w-6 h-6' : 'w-8 h-8'}`}
            />
          )}
          {post.isRealPost && (post as any).user_id === userId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background z-50">
                <DropdownMenuItem
                  onClick={() => deletePost()}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Caption */}
      {post.content && (
        <div className="px-5 pb-3">
          <CollapsibleCaption content={post.content} />
        </div>
      )}


      {/* FLUSH CONTENT: Edge-to-edge thumbnail/embed — skip entirely for posts with no media */}
      {r.kind !== 'none' ? (
        <div ref={embedRef} style={{ contain: 'layout paint' }}>
          <HydratedEmbed
            post={post}
            renderer={r}
            thumbnailUrl={effectiveThumbnail}
            isHydrated={isHydrated}
            onPlayClick={handlePlayClick}
          />
        </div>
      ) : (
        <div ref={embedRef} />
      )}

      {/* Title for video/image posts */}
      {post.title && (r.kind === 'image' || r.kind === 'video') && (
        <div className="px-5 pt-3">
          <h2 className="text-lg font-bold">{post.title}</h2>
        </div>
      )}

      {/* Interaction Bar - tight spacing, professional layout */}
      {/* For Instagram: pull bar up to cover native action buttons */}
      <div className={`flex items-center justify-around px-3 py-3 relative z-10 bg-background ${detectedPlatform === 'instagram' ? '-mt-10' : ''}`}>
        <button
          onClick={handleLikeClick}
          className="action-btn p-1.5 active:scale-90 transition-transform flex items-center gap-1"
        >
          <Heart 
            className={`h-6 w-6 stroke-[1.5] ${likeAnimating ? 'animate-like-pop' : ''}`}
            style={{ 
              fill: isLiked ? '#ef4444' : 'none',
              color: isLiked ? '#ef4444' : 'currentColor'
            }}
          />
          {!(post as any).hide_likes && (post as any).likes_count > 0 && (
            <span className="text-xs text-muted-foreground">{(post as any).likes_count}</span>
          )}
        </button>
        <button 
          onClick={() => setCommentsOpen(true)}
          className="action-btn p-1.5 active:scale-90 transition-transform flex items-center gap-1"
        >
          <MessageCircle className="h-6 w-6 stroke-[1.5] fill-none" />
          {(post as any).comments_count > 0 && (
            <span className="text-xs text-muted-foreground">{(post as any).comments_count}</span>
          )}
        </button>
        <button 
          onClick={handleRepostClick}
          className="action-btn p-1.5 active:scale-90 transition-transform"
        >
          <Repeat2 
            className={`h-7 w-7 stroke-[2] ${repostAnimating ? 'animate-repost-spin' : ''}`}
            style={{ color: isReposted ? '#22c55e' : 'currentColor' }}
          />
        </button>
        <button 
          onClick={handleShare}
          className="action-btn p-1.5 active:scale-90 transition-transform"
        >
          <Share className="h-6 w-6 stroke-[1.5]" />
        </button>
        <button
          onClick={() => toggleSave()}
          onPointerDown={() => {
            longPressTimer.current = setTimeout(() => {
              if (canUseActions) setCollectionSheetOpen(true);
            }, 500);
          }}
          onPointerUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
          onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
          className="action-btn p-1.5 active:scale-90 transition-transform"
        >
          <Bookmark className={`h-6 w-6 stroke-[1.5] ${isSaved ? 'fill-current' : 'fill-none'}`} />
        </button>
      </div>
      
      {post.isRealPost && (
        <CommentsDialog 
          open={commentsOpen} 
          onOpenChange={setCommentsOpen}
          postId={post.id}
          postAuthorId={(post as any).user_id}
        />
      )}

      {post.isRealPost && userId && (
        <SaveToCollectionSheet
          open={collectionSheetOpen}
          onOpenChange={setCollectionSheetOpen}
          postId={post.id}
          userId={userId}
        />
      )}
    </Card>
  );
};

// Deep memoization to prevent re-renders
const arePropsEqual = (prev: HydratedFeedPostProps, next: HydratedFeedPostProps) => {
  if (prev.userId !== next.userId) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.startHydrated !== next.startHydrated) return false;
  if (prev.post.id !== next.post.id) return false;
  
  const p = prev.post;
  const n = next.post;
  
  return (
    p.content === n.content &&
    p.title === n.title &&
    p.mediaUrl === n.mediaUrl &&
    p.thumbnailUrl === n.thumbnailUrl &&
    p.platform === n.platform &&
    p.saves === n.saves &&
    p.isRepost === n.isRepost &&
    p.repostedByUsername === n.repostedByUsername &&
    p.author.username === n.author.username &&
    p.author.avatar === n.author.avatar
  );
};

export const MemoizedHydratedFeedPost = memo(HydratedFeedPost, arePropsEqual);
