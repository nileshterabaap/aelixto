import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreVertical, Trash2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Post } from "@/data/demoData";
import { useState, useRef, memo, useCallback } from "react";
import { usePostActions } from "@/hooks/usePostActions";
import { useRepost } from "@/hooks/useReposts";
import { CommentsDialog } from "@/components/CommentsDialog";
import { LikesSheet } from "@/components/LikesSheet";
import { LazyEmbed } from "@/components/LazyEmbed";
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
import { TwitterEmbed } from "@/components/embeds/TwitterEmbed";
import { PinterestEmbed } from "@/components/embeds/PinterestEmbed";
import { RawEmbedRenderer } from "@/components/RawEmbedRenderer";
import { ThreadsAwareMetaEmbed as UniversalMetaEmbed } from "@/components/ThreadsAwareMetaEmbed";
import { OgCardFallback } from "@/components/OgCardFallback";
import { isEmbedEnabled, type EmbedPlatform, EMBED_FEATURE_FLAGS } from "@/config/embedFeatureFlags";
import { ArticleEmbed } from "@/features/article-embeds";
import RedditEmbed from "@/components/embeds/RedditEmbed";
import { resolveRenderer } from "@/lib/resolveRenderer";
import { QuoraPreviewCard } from "@/features/article-embeds/QuoraPreviewCard";
import { useVideoPlayTracking } from "@/hooks/useViewTracking";
import { ImageViewTracker } from "@/components/ImageViewTracker";
import { deriveThumbnailFromUrl } from "@/lib/deriveThumbnail";
import { YouTubeTitleFallback } from "@/components/YouTubeTitleFallback";
import { SharePostSheet } from "@/components/SharePostSheet";
import { PostReportMenu } from "@/components/PostReportMenu";
import { getOriginalPostCaption } from "@/lib/originalCaption";

interface FeedPostProps {
  post: Post & { isRealPost?: boolean; isRepost?: boolean; repostedByUsername?: string };
  userId?: string;
}

const formatTimestamp = (date: Date) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getPlatformIcon = (platform?: string) => {
  if (!platform) return null;
  
  switch (platform) {
    case 'youtube':
      return { name: 'YouTube', icon: youtubeIcon };
    case 'tiktok':
      return { name: 'TikTok', icon: tiktokIcon };
    case 'instagram':
      return { name: 'Instagram', icon: instagramIcon };
    case 'reddit':
      return { name: 'Reddit', icon: redditIcon };
    case 'twitter':
    case 'x':
      return { name: 'X', icon: twitterIcon };
    case 'pinterest':
      return { name: 'Pinterest', icon: pinterestIcon };
    case 'facebook':
      return { name: 'Facebook', icon: facebookIcon };
    case 'spotify':
      return { name: 'Spotify', icon: spotifyIcon };
    case 'quora':
      return { name: 'Quora', icon: quoraIcon };
    case 'medium':
      return { name: 'Medium', icon: mediumIcon };
    case 'threads':
      return { name: 'Threads', icon: threadsIcon };
    case 'linkedin':
      return { name: 'LinkedIn', icon: linkedinIcon };
    default:
      return null;
  }
};

const detectPlatformFromUrl = (url?: string) => {
  if (!url) return null;
  
  if (url.includes('spotify.com')) return 'spotify';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.me')) return 'facebook';
  if (url.includes('threads.net') || url.includes('threads.com')) return 'threads';
  if (url.includes('linkedin.com')) return 'linkedin';
  
  return null;
};

export const FeedPost = ({ post, userId }: FeedPostProps) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likesOpen, setLikesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [blogFavicon, setBlogFavicon] = useState<string | null>(null);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [repostAnimating, setRepostAnimating] = useState(false);
  const trackVideoPlay = useVideoPlayTracking();
  const lastTapRef = useRef<number>(0);
  const thumbnailUrl = post.thumbnailUrl || (post as any).thumbnail_url;
  const previewImageUrl = (post as any).preview_image_url;
  const mediaUrl = post.mediaUrl || (post as any).media_url;
  const previewTitle = (post as any).preview_title;
  const previewText = (post as any).preview_text;
  
  
  // Try to get platform from post.platform or detect from URL
  const detectedPlatform = post.platform || detectPlatformFromUrl(mediaUrl);
  const platform = getPlatformIcon(detectedPlatform);
  
  // Use blog favicon if available, otherwise use platform icon
  const displayIcon = blogFavicon || platform?.icon;
  const displayName = blogFavicon ? 'Blog' : platform?.name;
  
  // Check if this is a Quora URL for isolated preview card
  const isQuoraUrl =
    !!mediaUrl &&
    (() => {
      try {
        let urlToParse = mediaUrl.trim();
        
        // Return false if URL is empty or too short
        if (!urlToParse || urlToParse.length < 5) {
          return false;
        }
        
        // Clean URL: take first segment if there are spaces/duplicates
        urlToParse = urlToParse.split(/\s+/)[0];
        
        // Prepend 'https://' if no protocol is found
        if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
          urlToParse = `https://${urlToParse}`;
        }
        
        // Final check: ensure there's content after the protocol
        if (urlToParse === 'https://' || urlToParse === 'http://') {
          return false;
        }

        const url = new URL(urlToParse);
        return /(^|\.)quora\.com$/i.test(url.hostname);
      } catch {
        return false;
      }
    })();
  
  const embedEnabled = post.platform ? isEmbedEnabled(post.platform.toLowerCase() as EmbedPlatform) : true;
  
  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const isYouTubeShort = (url: string) => {
    if (url.includes('/shorts/')) return true;
    if (post.title && /#shorts?\b/i.test(post.title)) return true;
    if (post.content && /#shorts?\b/i.test(post.content)) return true;
    return false;
  };

  const getYouTubeThumbnail = (url: string) => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : url;
  };

  const handleYouTubeClick = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    // Check if this is a double tap
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      lastTapRef.current = 0;
      // Stop video if it started playing
      setIsPlayingVideo(false);
      // Open YouTube link
      if (post.mediaUrl) {
        window.open(post.mediaUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    
    // Single tap - play video immediately
    lastTapRef.current = now;
    if (post.isRealPost) {
      trackVideoPlay(post.id);
    }
    setIsPlayingVideo(true);
  };

  const handleVideoClick = () => {
    if (post.mediaType === 'video' && post.platform === 'youtube' && post.mediaUrl) {
      handleYouTubeClick();
    }
  };

  const handleNonYouTubeVideoPlay = async () => {
    if (post.isRealPost) {
      await trackVideoPlay(post.id);
    }
  };
  
  // Always call hooks unconditionally (React rules of hooks)
  const postActionsResult = usePostActions(post.id, userId || '');
  const repostActionsResult = useRepost(post.id, userId || '');
  
  // Only use actions for real posts with a user
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

  // Animated action handlers
  const handleLikeClick = useCallback(() => {
    if (!canUseActions) return;
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    setLikeAnimating(true);
    toggleLike();
    setTimeout(() => setLikeAnimating(false), 400);
  }, [canUseActions, toggleLike]);

  // Long-press (2s) on the like button opens the list of users who liked.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const startLikeLongPress = useCallback(() => {
    longPressFiredRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setLikesOpen(true);
    }, 2000);
  }, []);
  const cancelLikeLongPress = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const handleRepostClick = useCallback(() => {
    if (!canUseActions) return;
    setRepostAnimating(true);
    toggleRepost();
    setTimeout(() => setRepostAnimating(false), 500);
  }, [canUseActions, toggleRepost]);

  // Quora preview is fully isolated and optional.
  // If the flag is OFF, nothing changes.
  // If ON and URL is Quora, render the preview and RETURN early.
  // This does not touch Reddit or any other renderer.
  if (EMBED_FEATURE_FLAGS.quora_preview && isQuoraUrl) {
    return (
      <Card className="glass-post-card overflow-hidden rounded-[2rem]">
        <div className="p-5">
          {/* Author Info */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-12 w-12">
              {post.author.avatar ? (
                <AvatarImage src={post.author.avatar} alt={post.author.username} />
              ) : null}
              <AvatarFallback />
            </Avatar>
            <div className="flex-1 min-w-0">
              <UsernameLink username={post.author.username} className="font-bold text-base block">{post.author.username}</UsernameLink>
            </div>
          <div className="flex items-center gap-2 shrink-0 text-foreground">
            {displayIcon && post.platform !== 'twitter' && (
              <img 
                src={displayIcon} 
                alt={displayName || 'Platform'}
                className={`object-contain ${detectedPlatform === 'threads' ? 'w-5 h-5' : detectedPlatform === 'facebook' || detectedPlatform === 'quora' || detectedPlatform === 'spotify' || blogFavicon ? 'w-6 h-6' : 'w-8 h-8'}`}
              />
            )}
            {post.isRealPost && (post as any).user_id === userId ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                  >
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
            ) : post.isRealPost && (post as any).user_id ? (
              <PostReportMenu
                postId={post.id}
                authorUserId={(post as any).user_id}
                authorUsername={post.author?.username}
              />
            ) : null}
            </div>
          </div>

          {/* Caption with see more/less — user's own caption written on Aelixto.
              Instagram native caption is stripped in RawEmbedRenderer, so the
              user caption is safe to show for IG too. */}
          {post.content && (
            <CollapsibleCaption content={post.content} />
          )}

          {/* Quora Preview Card */}
          <div className="mb-2">
            <QuoraPreviewCard url={mediaUrl!} thumbnail={thumbnailUrl} />
          </div>

          {/* Title */}
          <div className="mt-3">
            <h2 className="text-lg font-bold">{post.title}</h2>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-around px-2 py-4 mt-1">
            <button
              onClick={handleLikeClick}
              onPointerDown={startLikeLongPress}
              onPointerUp={cancelLikeLongPress}
              onPointerLeave={cancelLikeLongPress}
              onPointerCancel={cancelLikeLongPress}
              onContextMenu={(e) => e.preventDefault()}
              className="action-btn p-2 active:scale-90 transition-transform flex items-center gap-1"
            >
              <Heart 
                className={`h-7 w-7 stroke-[1.5] ${
                  likeAnimating ? 'animate-like-pop' : ''
                }`}
                style={{ 
                  fill: isLiked ? '#ef4444' : 'none',
                  color: isLiked ? '#ef4444' : 'currentColor'
                }}
              />
            </button>
            {!(post as any).hide_likes && (post as any).likes_count > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLikesOpen(true); }}
                className="text-xs text-muted-foreground -ml-2 pr-1"
              >
                {(post as any).likes_count}
              </button>
            )}
            <button 
              onClick={() => setCommentsOpen(true)}
              className="action-btn p-2 active:scale-90 transition-transform flex items-center gap-1"
            >
              <MessageCircle className="h-7 w-7 stroke-[1.5] fill-none" />
              {(post as any).comments_count > 0 && (
                <span className="text-xs text-muted-foreground">{(post as any).comments_count}</span>
              )}
            </button>
            <button 
              onClick={handleRepostClick}
              className="action-btn p-2 active:scale-90 transition-transform"
            >
              <Repeat2 
                className={`h-8 w-8 stroke-[2.5] ${
                  repostAnimating ? 'animate-repost-spin' : ''
                }`}
                style={{ color: isReposted ? '#22c55e' : 'currentColor' }}
              />
            </button>
            <button 
              onClick={() => setShareOpen(true)}
              className="action-btn p-2 active:scale-90 transition-transform"
            >
              <Share className="h-7 w-7 stroke-[1.5]" />
            </button>
            <button
              onClick={() => toggleSave()}
              className="action-btn p-2 active:scale-90 transition-transform"
            >
              <Bookmark className={`h-7 w-7 stroke-[1.5] ${isSaved ? 'fill-current' : 'fill-none'}`} />
            </button>
          </div>
        </div>
        
        {post.isRealPost && (
          <CommentsDialog 
            open={commentsOpen} 
            onOpenChange={setCommentsOpen}
            postId={post.id}
            postAuthorId={(post as any).user_id}
          />
        )}
        <LikesSheet open={likesOpen} onOpenChange={setLikesOpen} postId={post.id} />
        {(
          <SharePostSheet 
            open={shareOpen} 
            onOpenChange={setShareOpen}
            postId={post.id}
          />
        )}
      </Card>
    );
  }

  // Check if this is a Facebook post that explicitly requires login
  const isFacebookUnavailable = post.platform === 'facebook' && (
    (post as any).title?.toLowerCase().includes('log in to facebook') ||
    (post as any).preview_title?.toLowerCase().includes('log in to facebook') ||
    post.mediaUrl?.includes('/login/')
  );

  const r = resolveRenderer(post);

  return (
    <Card className="glass-post-card overflow-hidden rounded-[2rem]">
      <div className="p-5">
        {/* Repost Indicator */}
        {post.isRepost && post.repostedByUsername && (
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Repeat2 className="w-4 h-4" />
            <span>Reposted by <UsernameLink username={post.repostedByUsername} className="font-semibold text-foreground">@{post.repostedByUsername}</UsernameLink></span>
          </div>
        )}
        
        {/* Author Info */}
        <div className="flex items-center gap-3 mb-4">
           <Avatar className="h-12 w-12">
              {post.author.avatar ? (
                <AvatarImage src={post.author.avatar} alt={post.author.username} />
              ) : null}
              <AvatarFallback />
            </Avatar>
          <div className="flex-1 min-w-0">
            <UsernameLink username={post.author.username} className="font-bold text-base block">{post.author.username}</UsernameLink>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-foreground">
            {displayIcon && post.platform !== 'twitter' && (
              <img 
                src={displayIcon} 
                alt={displayName || 'Platform'}
                className={`object-contain ${detectedPlatform === 'threads' ? 'w-5 h-5' : detectedPlatform === 'facebook' || detectedPlatform === 'quora' || detectedPlatform === 'spotify' || blogFavicon ? 'w-6 h-6' : 'w-8 h-8'}`}
              />
            )}
            {post.isRealPost && (post as any).user_id === userId ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                  >
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
            ) : post.isRealPost && (post as any).user_id ? (
              <PostReportMenu
                postId={post.id}
                authorUserId={(post as any).user_id}
                authorUsername={post.author?.username}
              />
            ) : null}
          </div>
        </div>

        {/* Caption with see more/less — user's own caption written on Aelixto. */}
        {post.content && (
          <CollapsibleCaption content={post.content} />
        )}

        {/* Original post caption fetched from the source link (Facebook /
            Threads / Reddit etc.). Always rendered below the user's caption
            and above the embed, with the same collapsible "... more" toggle. */}
        {(() => {
          const originalCaption = getOriginalPostCaption({
            previewText,
            title: post.title,
            userCaption: post.content,
            platform: detectedPlatform,
          });
          if (!originalCaption) return null;
          // Reddit and Threads official iframes already render the post
          // caption inside the embed, so skip the duplicate above.
          if (detectedPlatform === 'reddit' || detectedPlatform === 'threads' || detectedPlatform === 'twitter') return null;
          return (
            <CollapsibleCaption
              content={originalCaption}
              className="text-sm mb-3 text-muted-foreground"
            />
          );
        })()}

        {/* Feature flag check - show disabled message if embed is disabled */}
        {!embedEnabled && (
          <div className="rounded-2xl border-2 border-border bg-muted/30 p-8 text-center mb-3">
            <p className="text-sm font-semibold mb-2">
              🔒 {platform?.name || post.platform} embeds are currently disabled
            </p>
            <p className="text-xs text-muted-foreground">
              Enable in <code className="bg-muted px-1 py-0.5 rounded">src/config/embedFeatureFlags.ts</code>
            </p>
          </div>
        )}


        {/* Single renderer based on resolver */}
        {embedEnabled && (
          <div className="mb-2">
            {r.kind === 'raw' && post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={previewTitle || post.title}
                previewText={previewText}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <ImageViewTracker postId={post.id}>
                  <RawEmbedRenderer embedHtml={r.html} />
                </ImageViewTracker>
              </LazyEmbed>
            )}
            {r.kind === 'raw' && !post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={post.title}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <RawEmbedRenderer embedHtml={r.html} />
              </LazyEmbed>
            )}
            {r.kind === 'reddit' && post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={previewTitle || post.title}
                previewText={previewText}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <ImageViewTracker postId={post.id}>
                  <RedditEmbed url={r.url} />
                </ImageViewTracker>
              </LazyEmbed>
            )}
            {r.kind === 'reddit' && !post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={post.title}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <RedditEmbed url={r.url} />
              </LazyEmbed>
            )}
            {r.kind === 'twitter' && post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={previewTitle || post.title}
                previewText={previewText}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <ImageViewTracker postId={post.id}>
                  <TwitterEmbed url={r.url} />
                </ImageViewTracker>
              </LazyEmbed>
            )}
            {r.kind === 'twitter' && !post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={post.title}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <TwitterEmbed url={r.url} />
              </LazyEmbed>
            )}
            {r.kind === 'pinterest' && post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={previewTitle || post.title}
                previewText={previewText}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <ImageViewTracker postId={post.id}>
                  <PinterestEmbed url={r.url} />
                </ImageViewTracker>
              </LazyEmbed>
            )}
            {r.kind === 'pinterest' && !post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={post.title}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <PinterestEmbed url={r.url} />
              </LazyEmbed>
            )}
            {r.kind === 'article' && post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={previewTitle || post.title}
                previewText={previewText}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
                autoLoad={false}
              >
                <ImageViewTracker postId={post.id}>
                  <ArticleEmbed url={r.url} onFaviconLoaded={setBlogFavicon} />
                </ImageViewTracker>
              </LazyEmbed>
            )}
            {r.kind === 'article' && !post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={previewTitle || post.title}
                previewText={previewText}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
                autoLoad={false}
              >
                <ArticleEmbed url={r.url} onFaviconLoaded={setBlogFavicon} />
              </LazyEmbed>
            )}
            {r.kind === 'universal' && !isFacebookUnavailable && post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={previewTitle || post.title}
                previewText={previewText}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <ImageViewTracker postId={post.id}>
                  <UniversalMetaEmbed url={r.url} postId={post.id} suggestedHeight={(post as any).suggested_height ?? null} />
                </ImageViewTracker>
              </LazyEmbed>
            )}
            {r.kind === 'universal' && !isFacebookUnavailable && !post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={thumbnailUrl || previewImageUrl || deriveThumbnailFromUrl(mediaUrl, post.platform)}
                previewTitle={post.title}
                platform={post.platform || undefined}
                mediaUrl={mediaUrl}
              >
                <UniversalMetaEmbed url={r.url} postId={post.id} suggestedHeight={(post as any).suggested_height ?? null} />
              </LazyEmbed>
            )}
            {r.kind === 'universal' && isFacebookUnavailable && (
              <OgCardFallback
                url={r.url}
                title={previewTitle || post.title || "Facebook Post"}
                image={thumbnailUrl || previewImageUrl}
                description={previewText || "This Facebook post is no longer available, has been removed, or the privacy settings have changed."}
                platform="Facebook"
              />
            )}
            {r.kind === 'image' && post.isRealPost && (
              <ImageViewTracker postId={post.id}>
                <div className="rounded-2xl overflow-hidden">
                  <img 
                    src={r.url} 
                    alt="Post content" 
                    className="w-full h-auto object-cover aspect-video" 
                  />
                </div>
              </ImageViewTracker>
            )}
            {r.kind === 'image' && !post.isRealPost && (
              <div className="rounded-2xl overflow-hidden">
                <img 
                  src={r.url} 
                  alt="Post content" 
                  className="w-full h-auto object-cover aspect-video" 
                />
              </div>
            )}
            {r.kind === 'video' && post.platform === 'youtube' && (
              <LazyEmbed
                thumbnailUrl={getYouTubeThumbnail(r.url)}
                platform="youtube"
                mediaUrl={r.url}
              >
                <div className={`rounded-2xl overflow-hidden bg-muted relative ${
                  isYouTubeShort(r.url) ? 'aspect-[9/16]' : 'aspect-[16/9]'
                }`}>
                  {isPlayingVideo ? (
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div 
                      className="w-full h-full cursor-pointer group"
                      onClick={handleVideoClick}
                    >
                      <img
                        src={getYouTubeThumbnail(r.url)}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                        <div className="bg-red-600 rounded-full p-4 group-hover:scale-110 transition-transform">
                          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </LazyEmbed>
            )}
            {r.kind === 'video' && post.platform !== 'youtube' && (
              <div className="rounded-2xl overflow-hidden">
                <video 
                  src={r.url} 
                  className="w-full h-auto" 
                  controls 
                  playsInline
                  onPlay={handleNonYouTubeVideoPlay}
                />
              </div>
            )}
          </div>
        )}

        {/* Title - hide for embeds that contain their own title/caption */}
        {(r.kind === 'image' || (r.kind === 'video' && post.platform === 'youtube')) && (
          <div className="mt-3">
            {post.platform === 'youtube' ? (
              <YouTubeTitleFallback mediaUrl={mediaUrl} title={post.title} />
            ) : (
              <h2 className="text-lg font-bold">{post.title}</h2>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-around px-2 py-4 mt-1">
          <button
            onClick={handleLikeClick}
            onPointerDown={startLikeLongPress}
            onPointerUp={cancelLikeLongPress}
            onPointerLeave={cancelLikeLongPress}
            onPointerCancel={cancelLikeLongPress}
            onContextMenu={(e) => e.preventDefault()}
            className="action-btn p-2 active:scale-90 transition-transform flex items-center gap-1"
          >
            <Heart 
              className={`h-7 w-7 stroke-[1.5] ${
                likeAnimating ? 'animate-like-pop' : ''
              }`}
              style={{ 
                fill: isLiked ? '#ef4444' : 'none',
                color: isLiked ? '#ef4444' : 'currentColor'
              }}
            />
          </button>
          {!(post as any).hide_likes && (post as any).likes_count > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLikesOpen(true); }}
              className="text-xs text-muted-foreground -ml-2 pr-1"
            >
              {(post as any).likes_count}
            </button>
          )}
          <button 
            onClick={() => setCommentsOpen(true)}
            className="action-btn p-2 active:scale-90 transition-transform flex items-center gap-1"
          >
            <MessageCircle className="h-7 w-7 stroke-[1.5] fill-none" />
            {(post as any).comments_count > 0 && (
              <span className="text-xs text-muted-foreground">{(post as any).comments_count}</span>
            )}
          </button>
          <button 
            onClick={handleRepostClick}
            className="action-btn p-2 active:scale-90 transition-transform"
          >
            <Repeat2 
              className={`h-8 w-8 stroke-[2.5] ${
                repostAnimating ? 'animate-repost-spin' : ''
              }`}
              style={{ color: isReposted ? '#22c55e' : 'currentColor' }}
            />
          </button>
          <button 
            onClick={() => setShareOpen(true)}
            className="action-btn p-2 active:scale-90 transition-transform"
          >
            <Share className="h-7 w-7 stroke-[1.5]" />
          </button>
          <button
            onClick={() => toggleSave()}
            className="action-btn p-2 active:scale-90 transition-transform"
          >
            <Bookmark className={`h-7 w-7 stroke-[1.5] ${isSaved ? 'fill-current' : 'fill-none'}`} />
          </button>
        </div>
      </div>
      
      {post.isRealPost && (
        <CommentsDialog 
          open={commentsOpen} 
          onOpenChange={setCommentsOpen}
          postId={post.id}
          postAuthorId={(post as any).user_id}
        />
      )}
      <LikesSheet open={likesOpen} onOpenChange={setLikesOpen} postId={post.id} />
      {(
        <SharePostSheet 
          open={shareOpen} 
          onOpenChange={setShareOpen}
          postId={post.id}
        />
      )}
    </Card>
  );
};

// Memoize the component with deep comparison of critical post fields
// This prevents re-renders when parent re-renders but post data hasn't changed
const arePropsEqual = (prev: FeedPostProps, next: FeedPostProps) => {
  // Quick bailout if post object reference changed but data is the same
  if (prev.userId !== next.userId) return false;
  if (prev.post.id !== next.post.id) return false;
  
  // Compare stable post fields that affect rendering
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

export const MemoizedFeedPost = memo(FeedPost, arePropsEqual);
