import { Heart, MessageCircle, Repeat2, Share, Bookmark, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Post } from "@/data/demoData";
import { useState, memo } from "react";
import { usePostActions } from "@/hooks/usePostActions";
import { useRepost } from "@/hooks/useReposts";
import { CommentsDialog } from "@/components/CommentsDialog";
import { LazyEmbed } from "@/components/LazyEmbed";
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
import { TwitterEmbed } from "@/components/embeds/TwitterEmbed";
import { PinterestEmbed } from "@/components/embeds/PinterestEmbed";
import { RawEmbedRenderer } from "@/components/RawEmbedRenderer";
import { UniversalMetaEmbed } from "@/components/UniversalMetaEmbed";
import { isEmbedEnabled, type EmbedPlatform, EMBED_FEATURE_FLAGS } from "@/config/embedFeatureFlags";
import { ArticleEmbed } from "@/features/article-embeds";
import RedditEmbed from "@/components/embeds/RedditEmbed";
import { resolveRenderer } from "@/lib/resolveRenderer";
import { QuoraPreviewCard } from "@/features/article-embeds/QuoraPreviewCard";
import { useVideoPlayTracking } from "@/hooks/useViewTracking";
import { ImageViewTracker } from "@/components/ImageViewTracker";

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
    default:
      return null;
  }
};

const detectPlatformFromUrl = (url?: string) => {
  if (!url) return null;
  
  if (url.includes('spotify.com')) return 'spotify';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.me')) return 'facebook';
  
  return null;
};

export const FeedPost = ({ post, userId }: FeedPostProps) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [blogFavicon, setBlogFavicon] = useState<string | null>(null);
  const trackVideoPlay = useVideoPlayTracking();
  
  // Try to get platform from post.platform or detect from URL
  const detectedPlatform = post.platform || detectPlatformFromUrl(post.mediaUrl);
  const platform = getPlatformIcon(detectedPlatform);
  
  // Use blog favicon if available, otherwise use platform icon
  const displayIcon = blogFavicon || platform?.icon;
  const displayName = blogFavicon ? 'Blog' : platform?.name;
  
  // Check if this is a Quora URL for isolated preview card
  const isQuoraUrl =
    !!post.mediaUrl &&
    (() => {
      try {
        let urlToParse = post.mediaUrl.trim();
        
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
  
  // Check if this embed type is enabled via feature flags
  const embedEnabled = post.platform ? isEmbedEnabled(post.platform.toLowerCase() as EmbedPlatform) : true;
  
  console.log("[FeedPost] Rendering post:", post.id, "Platform:", post.platform, "Enabled:", embedEnabled, "MediaURL:", post.mediaUrl, "MediaType:", post.mediaType, "EmbedHTML:", (post as any).embed_html);
  
  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const isYouTubeShort = (url: string) => {
    return url.includes('/shorts/');
  };

  const getYouTubeThumbnail = (url: string) => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : url;
  };

  const handleVideoClick = async () => {
    if (post.mediaType === 'video' && post.platform === 'youtube' && post.mediaUrl) {
      // Track video play event before starting playback
      if (post.isRealPost) {
        await trackVideoPlay(post.id);
      }
      setIsPlayingVideo(true);
    }
  };

  const handleNonYouTubeVideoPlay = async () => {
    if (post.isRealPost) {
      await trackVideoPlay(post.id);
    }
  };
  
  // Only use post actions for real posts
  const postActions = post.isRealPost && userId 
    ? usePostActions(post.id, userId)
    : { 
        isLiked: false, 
        isSaved: false, 
        toggleLike: () => {}, 
        toggleSave: () => {}, 
        handleShare: () => {}, 
        deletePost: () => {},
        isDeleting: false 
      };

  const repostActions = post.isRealPost && userId
    ? useRepost(post.id, userId)
    : { isReposted: false, toggleRepost: () => {}, isReposting: false };

  const { isLiked, isSaved, toggleLike, toggleSave, handleShare, deletePost, isDeleting } = postActions;
  const { isReposted, toggleRepost } = repostActions;

  // Quora preview is fully isolated and optional.
  // If the flag is OFF, nothing changes.
  // If ON and URL is Quora, render the preview and RETURN early.
  // This does not touch Reddit or any other renderer.
  if (EMBED_FEATURE_FLAGS.quora_preview && isQuoraUrl) {
    return (
      <Card className="overflow-hidden border-2 border-foreground rounded-[2rem]">
        <div className="p-5">
          {/* Author Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden bg-muted">
              <img 
                src={post.author.avatar} 
                alt={post.author.username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">{post.author.username}</p>
            </div>
          <div className="flex items-center gap-2 shrink-0">
            {displayIcon && post.platform !== 'twitter' && (
              <img 
                src={displayIcon} 
                alt={displayName || 'Platform'}
                className={`object-contain ${detectedPlatform === 'facebook' || detectedPlatform === 'quora' || detectedPlatform === 'spotify' || blogFavicon ? 'w-6 h-6' : 'w-8 h-8'}`}
              />
            )}
            {post.isRealPost && (post as any).user_id === userId && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => deletePost()}
                disabled={isDeleting}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            </div>
          </div>

          {/* Caption */}
          {post.content && (
            <p className="text-sm mb-3">{post.content}</p>
          )}

          {/* Quora Preview Card */}
          <div className="mb-2">
            <QuoraPreviewCard url={post.mediaUrl!} thumbnail={(post as any).thumbnail_url} />
          </div>

          {/* Title */}
          <div className="mt-3">
            <h2 className="text-lg font-bold">{post.title}</h2>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-around px-2 py-4 mt-1">
            <button
              onClick={() => toggleLike()}
              className="p-2 hover:opacity-60 transition-opacity"
            >
              <Heart className={`h-7 w-7 stroke-[1.5] ${isLiked ? 'fill-red-500 text-red-500' : 'fill-none'}`} />
            </button>
            <button 
              onClick={() => setCommentsOpen(true)}
              className="p-2 hover:opacity-60 transition-opacity"
            >
              <MessageCircle className="h-7 w-7 stroke-[1.5] fill-none" />
            </button>
            <button 
              onClick={() => toggleRepost()}
              className="p-2 hover:opacity-60 transition-opacity"
            >
              <Repeat2 className={`h-8 w-8 stroke-[2.5] ${isReposted ? 'text-green-500' : ''}`} />
            </button>
            <button 
              onClick={handleShare}
              className="p-2 hover:opacity-60 transition-opacity"
            >
              <Share className="h-7 w-7 stroke-[1.5]" />
            </button>
            <button
              onClick={() => toggleSave()}
              className="p-2 hover:opacity-60 transition-opacity"
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
          />
        )}
      </Card>
    );
  }

  const r = resolveRenderer(post);
  console.log('renderer', post.id, post.platform, post.mediaUrl, r.kind);

  return (
    <Card className="overflow-hidden border-2 border-foreground rounded-[2rem]">
      <div className="p-5">
        {/* Repost Indicator */}
        {post.isRepost && post.repostedByUsername && (
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Repeat2 className="w-4 h-4" />
            <span>Reposted by <span className="font-semibold text-foreground">@{post.repostedByUsername}</span></span>
          </div>
        )}
        
        {/* Author Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden bg-muted">
            <img 
              src={post.author.avatar} 
              alt={post.author.username}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base">{post.author.username}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {displayIcon && post.platform !== 'twitter' && (
              <img 
                src={displayIcon} 
                alt={displayName || 'Platform'}
                className={`object-contain ${detectedPlatform === 'facebook' || detectedPlatform === 'quora' || detectedPlatform === 'spotify' || blogFavicon ? 'w-6 h-6' : 'w-8 h-8'}`}
              />
            )}
            {post.isRealPost && (post as any).user_id === userId && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => deletePost()}
                disabled={isDeleting}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Caption */}
        {post.content && (
          <p className="text-sm mb-3">{post.content}</p>
        )}

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
                thumbnailUrl={(post as any).thumbnail_url}
                previewTitle={(post as any).preview_title}
                previewText={(post as any).preview_text}
                platform={post.platform || undefined}
                mediaUrl={post.mediaUrl}
              >
                <ImageViewTracker postId={post.id}>
                  <RawEmbedRenderer embedHtml={r.html} />
                </ImageViewTracker>
              </LazyEmbed>
            )}
            {r.kind === 'raw' && !post.isRealPost && (
              <LazyEmbed
                thumbnailUrl={(post as any).thumbnail_url}
                platform={post.platform || undefined}
                mediaUrl={post.mediaUrl}
              >
                <RawEmbedRenderer embedHtml={r.html} />
              </LazyEmbed>
            )}
            {r.kind === 'reddit' && post.isRealPost && (
              <ImageViewTracker postId={post.id}>
                <RedditEmbed url={r.url} />
              </ImageViewTracker>
            )}
            {r.kind === 'reddit' && !post.isRealPost && <RedditEmbed url={r.url} />}
            {r.kind === 'twitter' && post.isRealPost && (
              <ImageViewTracker postId={post.id}>
                <TwitterEmbed url={r.url} />
              </ImageViewTracker>
            )}
            {r.kind === 'twitter' && !post.isRealPost && <TwitterEmbed url={r.url} />}
            {r.kind === 'pinterest' && post.isRealPost && (
              <ImageViewTracker postId={post.id}>
                <PinterestEmbed url={r.url} />
              </ImageViewTracker>
            )}
            {r.kind === 'pinterest' && !post.isRealPost && <PinterestEmbed url={r.url} />}
            {r.kind === 'article' && post.isRealPost && (
              <ImageViewTracker postId={post.id}>
                <ArticleEmbed url={r.url} onFaviconLoaded={setBlogFavicon} />
              </ImageViewTracker>
            )}
            {r.kind === 'article' && !post.isRealPost && <ArticleEmbed url={r.url} onFaviconLoaded={setBlogFavicon} />}
            {r.kind === 'universal' && post.isRealPost && (
              <ImageViewTracker postId={post.id}>
                <UniversalMetaEmbed url={r.url} />
              </ImageViewTracker>
            )}
            {r.kind === 'universal' && !post.isRealPost && <UniversalMetaEmbed url={r.url} />}
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
                      src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=1`}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
            <h2 className="text-lg font-bold">{post.title}</h2>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-around px-2 py-4 mt-1">
          <button
            onClick={() => toggleLike()}
            className="p-2 hover:opacity-60 transition-opacity"
          >
            <Heart className={`h-7 w-7 stroke-[1.5] ${isLiked ? 'fill-red-500 text-red-500' : 'fill-none'}`} />
          </button>
          <button 
            onClick={() => setCommentsOpen(true)}
            className="p-2 hover:opacity-60 transition-opacity"
          >
            <MessageCircle className="h-7 w-7 stroke-[1.5] fill-none" />
          </button>
          <button 
            onClick={() => toggleRepost()}
            className="p-2 hover:opacity-60 transition-opacity"
          >
            <Repeat2 className={`h-8 w-8 stroke-[2.5] ${isReposted ? 'text-green-500' : ''}`} />
          </button>
          <button 
            onClick={handleShare}
            className="p-2 hover:opacity-60 transition-opacity"
          >
            <Share className="h-7 w-7 stroke-[1.5]" />
          </button>
          <button
            onClick={() => toggleSave()}
            className="p-2 hover:opacity-60 transition-opacity"
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
        />
      )}
    </Card>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const MemoizedFeedPost = memo(FeedPost, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.userId === nextProps.userId
  );
});
