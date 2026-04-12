import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreVertical, Trash2, Play, RefreshCw } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Post } from "@/data/demoData";
import { useState, useRef, memo, useCallback, useEffect, useMemo } from "react";
import { EmbedSkeleton } from "@/components/EmbedSkeleton";

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
import { YouTubeTitleFallback } from "@/components/YouTubeTitleFallback";
import { resolveRenderer } from "@/lib/resolveRenderer";
import { SharePostSheet } from "@/components/SharePostSheet";

// Module-level cache: posts that have already completed their reveal cycle
// skip all skeleton/transition machinery on subsequent renders (scroll back, remount, etc.)
const revealedPostsCache = new Set<string>();
const HYDRATION_ROOT_MARGIN = '3000px 0px';

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
  // If this post was already revealed in a previous render, skip ALL skeleton/transition work
  const alreadyRevealed = revealedPostsCache.has(post.id);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(startHydrated || alreadyRevealed);

  // Unified embed state machine: 'loading' → 'ready' | 'error'
  type EmbedState = 'loading' | 'ready' | 'error';
  const [embedState, setEmbedState] = useState<EmbedState>(alreadyRevealed ? 'ready' : 'loading');
  const [skeletonVisible, setSkeletonVisible] = useState(!alreadyRevealed);
  const [isSharpened, setIsSharpened] = useState(alreadyRevealed);

  const cardMeasureRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const likeControls = useAnimation();
  const repostControls = useAnimation();
  const commentControls = useAnimation();
  const saveControls = useAnimation();
  const [displayLikeCount, setDisplayLikeCount] = useState<number>(Number((post as any).likes_count ?? (post as any).likes ?? 0));
  const [displayCommentCount] = useState<number>(Number((post as any).comments_count ?? (post as any).comments ?? 0));
  const [displayRepostCount, setDisplayRepostCount] = useState<number>(Number((post as any).reposts_count ?? (post as any).shares ?? 0));
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embedRef = useRef<HTMLDivElement>(null);

  // Only hydrate embeds that are actually near the viewport.
  // Hydrating too many posts at once keeps the main thread busy on mobile
  // and makes follow-up swipes feel delayed while momentum scrolling.
  const [isNearViewport, setIsNearViewport] = useState(startHydrated || alreadyRevealed);

  useEffect(() => {
    if (startHydrated || alreadyRevealed) return;
    const el = embedRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(entry.isIntersecting);
      },
      // Huge margin: start hydration ~5 screens away so the entire reveal
      // cycle (embed load + skeleton fade) finishes before the post is visible
      { rootMargin: HYDRATION_ROOT_MARGIN, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startHydrated, alreadyRevealed]);

  // Hydrate immediately when near viewport — no velocity gating.
  useEffect(() => {
    if (isHydrated || !isNearViewport) return;
    setIsHydrated(true);
  }, [isNearViewport, isHydrated]);

  // Unified embed detection: detect when embed content is ready or error
  // Single 4s fallback timeout for ALL platforms
  useEffect(() => {
    if (!isHydrated || embedState !== 'loading' || alreadyRevealed) return;
    const el = embedRef.current;
    if (!el) return;

    let settled = false;
    const handledIframes = new WeakSet<HTMLIFrameElement>();
    const handledImages = new WeakSet<HTMLImageElement>();
    const handledVideos = new WeakSet<HTMLVideoElement>();

    const markReady = () => {
      if (settled) return;
      settled = true;
      setEmbedState('ready');
    };

    const getRendererStatuses = () =>
      Array.from(el.querySelectorAll<HTMLElement>('[data-embed-status]'))
        .map((node) => node.dataset.embedStatus)
        .filter((status): status is 'loading' | 'ready' => status === 'loading' || status === 'ready');

    const attachIframeHandlers = () => {
      const iframes = el.querySelectorAll('iframe');
      let hasLoadedIframe = false;

      if (iframes.length > 0) {
        iframes.forEach((iframe) => {
          if ((iframe as HTMLIFrameElement).dataset.embedLoaded === 'true') {
            hasLoadedIframe = true;
            return;
          }

          if (handledIframes.has(iframe as HTMLIFrameElement)) return;
          handledIframes.add(iframe as HTMLIFrameElement);

          const handleIframeSettled = () => {
            (iframe as HTMLIFrameElement).dataset.embedLoaded = 'true';
            markReady();
          };

          iframe.addEventListener('load', handleIframeSettled, { once: true });
          iframe.addEventListener('error', handleIframeSettled, { once: true });
        });
      }

      return iframes.length > 0 ? hasLoadedIframe : false;
    };

    const attachImageHandlers = (image: HTMLImageElement) => {
      if (image.complete && image.naturalWidth > 0) return true;
      if (handledImages.has(image)) return false;

      handledImages.add(image);
      image.addEventListener('load', markReady, { once: true });
      image.addEventListener('error', markReady, { once: true });
      return false;
    };

    const attachVideoHandlers = (video: HTMLVideoElement) => {
      if (video.readyState >= 2) return true;
      if (handledVideos.has(video)) return false;

      handledVideos.add(video);
      video.addEventListener('loadeddata', markReady, { once: true });
      video.addEventListener('canplay', markReady, { once: true });
      video.addEventListener('error', markReady, { once: true });
      return false;
    };

    // Only reveal once actual media is settled, not when wrapper DOM first appears.
    const checkContent = () => {
      const rendererStatuses = getRendererStatuses();

      if (rendererStatuses.includes('loading')) {
        return false;
      }

      const mediaNodes = Array.from(
        el.querySelectorAll('img[src]:not([src=""]), video[src]:not([src=""]), iframe')
      );

      if (mediaNodes.length === 0) {
        if (rendererStatuses.includes('ready')) {
          markReady();
          return true;
        }
        return false;
      }

      const iframes = mediaNodes.filter((node): node is HTMLIFrameElement => node instanceof HTMLIFrameElement);
      if (iframes.length > 0) {
        if (attachIframeHandlers()) {
          markReady();
        }
        return true;
      }

      const videos = mediaNodes.filter((node): node is HTMLVideoElement => node instanceof HTMLVideoElement);
      if (videos.length > 0) {
        if (videos.some(attachVideoHandlers)) {
          markReady();
        }
        return true;
      }

      const images = mediaNodes.filter((node): node is HTMLImageElement => node instanceof HTMLImageElement);
      if (images.length > 0) {
        if (images.some(attachImageHandlers)) {
          markReady();
        }
        return true;
      }

      if (rendererStatuses.includes('ready')) {
        markReady();
        return true;
      }

      return false;
    };

    if (checkContent()) {
      const hardFallback = setTimeout(markReady, 12000);
      return () => { settled = true; clearTimeout(hardFallback); };
    }

    const observer = new MutationObserver(() => { checkContent(); });
    observer.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-embed-status'],
    });

    // Listen for custom embedReady events dispatched by platform-specific renderers
    // (e.g. TwitterEmbed fires this after createTweet resolves)
    const handleEmbedReady = () => { markReady(); };
    el.addEventListener('embedReady', handleEmbedReady);

    // Soft fallback: only reveal early if no renderer is still actively loading.
    // Facebook SDK divs take longer (5-8s), so extend the soft fallback for them.
    const isFacebookPost = detectedPlatform === 'facebook';
    const softTimeout = isFacebookPost ? 8000 : 4000;
    const fallback = setTimeout(() => {
      if (settled) return;
      if (checkContent()) return;
      if (!getRendererStatuses().includes('loading')) {
        markReady();
      }
    }, softTimeout);

    // Hard fallback: never leave a post stuck forever.
    const hardFallback = setTimeout(markReady, 12000);

    return () => {
      settled = true;
      observer.disconnect();
      el.removeEventListener('embedReady', handleEmbedReady);
      clearTimeout(fallback);
      clearTimeout(hardFallback);
    };
  }, [isHydrated, embedState, alreadyRevealed]);

  // Unified reveal sequence: when embedState becomes 'ready', reveal card and sharpen
  useEffect(() => {
    if (embedState !== 'ready' || alreadyRevealed) return;
    let cancelled = false;

    // Remove skeleton quickly
    const skeletonTimer = setTimeout(() => {
      if (!cancelled) {
        setSkeletonVisible(false);
        revealedPostsCache.add(post.id);
      }
    }, 200);

    // Sharpen immediately after skeleton removal
    const sharpenTimer = setTimeout(() => {
      if (!cancelled) setIsSharpened(true);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(skeletonTimer);
      clearTimeout(sharpenTimer);
    };
  }, [embedState, alreadyRevealed, post.id]);

  // Resolve the embed type for rendering — must be before effects that use isTextOnly
  const r = resolveRenderer(post);
  const isTextOnly = r.kind === 'none';

  // Measure card height and sync to skeleton wrapper to prevent layout shift
  useEffect(() => {
    if (alreadyRevealed || isTextOnly) return;
    const card = cardMeasureRef.current;
    if (!card) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (h > 0) setMeasuredHeight(h);
      }
    });
    ro.observe(card);
    return () => ro.disconnect();
  }, [alreadyRevealed, isTextOnly]);

  // Once hydrated, stay hydrated - prevents expensive re-initialization on scroll back

  
  // Normalize field access
  const thumbnailUrl = post.thumbnailUrl || (post as any).thumbnail_url;
  const previewImageUrl = (post as any).preview_image_url;
  const mediaUrl = post.mediaUrl || (post as any).media_url;
  
  // Detect platform
  const detectedPlatform = post.platform || detectPlatformFromUrl(mediaUrl);
  const isYouTubePost = detectedPlatform === 'youtube';
  const shouldRenderMediaTitle = isYouTubePost || r.kind === 'image' || r.kind === 'video';
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
        deletePost: () => {},
        isDeleting: false 
      };

  const repostActions = canUseActions
    ? repostActionsResult
    : { isReposted: false, toggleRepost: () => {}, isReposting: false };

  const { isLiked, isSaved, toggleLike, toggleSave, deletePost, isDeleting } = postActions;
  const { isReposted, toggleRepost } = repostActions;

  useEffect(() => {
    setDisplayLikeCount(Number((post as any).likes_count ?? (post as any).likes ?? 0));
    setDisplayRepostCount(Number((post as any).reposts_count ?? (post as any).shares ?? 0));
  }, [post.id, (post as any).likes_count, (post as any).likes, (post as any).reposts_count, (post as any).shares]);

  const handleLikeClick = useCallback(() => {
    if (!canUseActions) return;
    setDisplayLikeCount((current) => Math.max(0, current + (isLiked ? -1 : 1)));
    toggleLike();
    if (isLiked) {
      likeControls.start({ scale: [1, 0.85, 1], transition: { duration: 0.3, ease: 'easeOut' } });
    } else {
      likeControls.start({ scale: [1, 1.4, 1], transition: { type: 'spring', stiffness: 500, damping: 15, duration: 0.3 } });
    }
  }, [canUseActions, isLiked, toggleLike, likeControls]);

  const handleRepostClick = useCallback(() => {
    if (!canUseActions) return;
    setDisplayRepostCount((current) => Math.max(0, current + (isReposted ? -1 : 1)));
    toggleRepost();
    repostControls.start({ rotate: [0, 360], transition: { duration: 0.4, ease: 'easeOut' } });
  }, [canUseActions, isReposted, toggleRepost, repostControls]);

  const handlePlayClick = useCallback(() => {
    setIsHydrated(true);
  }, []);

  // Derive thumbnail: prefer stored, then derive from URL
  const effectiveThumbnail = thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform);

  const showCard = isTextOnly || embedState === 'ready' || embedState === 'error';

  return (
    <div className="relative">
      {/* Skeleton placeholder — occupies space until card reveals */}
      {!isTextOnly && skeletonVisible && (
        <div
          className="rounded-xl overflow-hidden transition-opacity duration-300 ease-in-out"
          style={{
            opacity: showCard ? 0 : 1,
            pointerEvents: showCard ? 'none' : 'auto',
            ...(measuredHeight ? { minHeight: measuredHeight } : {}),
          }}
        >
          <EmbedSkeleton platform={detectedPlatform || undefined} />
        </div>
      )}

      {/* Real card — hidden until embed loads, fades in blurred, then sharpens */}
      <div
        ref={cardMeasureRef}
        className={`overflow-hidden rounded-xl ${!isTextOnly && skeletonVisible ? 'absolute inset-0' : ''}`}
        style={{
          opacity: showCard ? 1 : 0,
          visibility: showCard ? 'visible' : 'hidden',
          filter: alreadyRevealed ? 'none' : (isSharpened ? 'blur(0px)' : 'blur(4px)'),
          transition: 'opacity 250ms ease-in-out, filter 400ms ease-out',
        }}
      >
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
        <Avatar className="h-12 w-12 shrink-0">
          {post.author.avatar ? (
            <AvatarImage src={post.author.avatar} alt={post.author.username} />
          ) : null}
          <AvatarFallback />
        </Avatar>
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
        <div ref={embedRef} className="relative" style={{ contain: 'layout paint' }}>
          {/* Error state — clean fallback with refresh */}
          {embedState === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <p className="text-sm">Could not load post</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmbedState('loading');
                  setIsHydrated(false);
                  setSkeletonVisible(true);
                  setIsSharpened(false);
                  // Re-trigger hydration
                  setTimeout(() => setIsHydrated(true), 50);
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {/* Embed layer — always fully visible; parent card handles reveal */}
          {embedState !== 'error' && (
            <div>
              <HydratedEmbed
                post={post}
                renderer={r}
                thumbnailUrl={effectiveThumbnail}
                isHydrated={isHydrated}
                onPlayClick={handlePlayClick}
              />
            </div>
          )}
        </div>
      ) : (
        <div ref={embedRef} />
      )}

      {/* Title for video/image posts */}
      {shouldRenderMediaTitle && (
        <div className="px-5 pt-3">
          {isYouTubePost ? (
            <YouTubeTitleFallback mediaUrl={mediaUrl} title={post.title} />
          ) : (
            post.title && <h2 className="text-lg font-bold">{post.title}</h2>
          )}
        </div>
      )}

      {/* Interaction Bar - tight spacing, professional layout */}
      {/* For Instagram: pull bar up to cover native action buttons */}
      <div className={`flex items-center justify-around px-3 py-3 relative z-10 bg-background ${detectedPlatform === 'instagram' ? '-mt-10' : ''}`}>
        <motion.button
          onClick={handleLikeClick}
          animate={likeControls}
          whileTap={{ scale: 0.9 }}
          className="action-btn p-1.5 flex items-center gap-1"
        >
          <Heart 
            className="h-6 w-6 stroke-[1.5]"
            style={{ 
              fill: isLiked ? '#ef4444' : 'none',
              color: isLiked ? '#ef4444' : 'currentColor',
              transition: 'fill 200ms ease, color 200ms ease',
            }}
          />
          {!(post as any).hide_likes && displayLikeCount > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">{displayLikeCount}</span>
          )}
        </motion.button>
        <motion.button 
          onClick={() => {
            setCommentsOpen(true);
            commentControls.start({ scale: [1, 1.2, 1], transition: { duration: 0.2, ease: 'easeOut' } });
          }}
          animate={commentControls}
          whileTap={{ scale: 0.9 }}
          className="action-btn p-1.5 flex items-center gap-1"
        >
          <MessageCircle className="h-6 w-6 stroke-[1.5] fill-none" />
          {displayCommentCount > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">{displayCommentCount}</span>
          )}
        </motion.button>
        <motion.button 
          onClick={handleRepostClick}
          animate={repostControls}
          whileTap={{ scale: 0.9 }}
          className="action-btn p-1.5 flex items-center gap-1"
        >
          <Repeat2 
            className="h-7 w-7 stroke-[2]"
            style={{ 
              color: isReposted ? '#22c55e' : 'currentColor',
              transition: 'color 200ms ease',
            }}
          />
          {displayRepostCount > 0 && (
            <span className="text-xs font-semibold text-muted-foreground">{displayRepostCount}</span>
          )}
        </motion.button>
        <motion.button 
          onClick={() => setShareOpen(true)}
          whileTap={{ scale: 0.9 }}
          className="action-btn p-1.5"
        >
          <Share className="h-6 w-6 stroke-[1.5]" />
        </motion.button>
        <motion.button
          onClick={() => {
            toggleSave();
            saveControls.start({ scale: [1, 1.3, 1], transition: { type: 'spring', stiffness: 500, damping: 15, duration: 0.3 } });
          }}
          animate={saveControls}
          whileTap={{ scale: 0.9 }}
          onPointerDown={() => {
            longPressTimer.current = setTimeout(() => {
              if (canUseActions) setCollectionSheetOpen(true);
            }, 500);
          }}
          onPointerUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
          onPointerLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
          className="action-btn p-1.5"
        >
          <Bookmark 
            className="h-6 w-6 stroke-[1.5]"
            style={{
              fill: isSaved ? 'currentColor' : 'none',
              transition: 'fill 200ms ease',
            }}
          />
        </motion.button>
      </div>
      
      {post.isRealPost && (
        <CommentsDialog 
          open={commentsOpen} 
          onOpenChange={setCommentsOpen}
          postId={post.id}
          postAuthorId={(post as any).user_id}
        />
      )}

      <SharePostSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        postId={post.id}
      />

      {post.isRealPost && userId && (
        <SaveToCollectionSheet
          open={collectionSheetOpen}
          onOpenChange={setCollectionSheetOpen}
          postId={post.id}
          userId={userId}
        />
      )}
    </Card>
      </div>
    </div>
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
