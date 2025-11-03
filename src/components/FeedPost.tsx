import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Post } from "@/data/demoData";
import { useState } from "react";
import { usePostActions } from "@/hooks/usePostActions";
import { CommentsDialog } from "@/components/CommentsDialog";
import youtubeIcon from "@/assets/youtube-icon.png";
import instagramIcon from "@/assets/instagram-icon.png";
import tiktokIcon from "@/assets/tiktok-icon.png";
import redditIcon from "@/assets/reddit-icon.png";
import twitterIcon from "@/assets/twitter-icon.png";
import pinterestIcon from "@/assets/pinterest-icon.png";
import { TwitterEmbed } from "@/components/embeds/TwitterEmbed";
import { PinterestEmbed } from "@/components/embeds/PinterestEmbed";
import { RawEmbedRenderer } from "@/components/RawEmbedRenderer";
import { UniversalMetaEmbed } from "@/components/UniversalMetaEmbed";
import { isEmbedEnabled, type EmbedPlatform, EMBED_FEATURE_FLAGS } from "@/config/embedFeatureFlags";
import { ArticleEmbed } from "@/features/article-embeds";
import RedditEmbed from "@/components/embeds/RedditEmbed";
import { resolveRenderer } from "@/lib/resolveRenderer";
import { QuoraPreviewCard } from "@/features/article-embeds/QuoraPreviewCard";

interface FeedPostProps {
  post: Post & { isRealPost?: boolean };
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
      return { name: 'X', icon: twitterIcon };
    case 'pinterest':
      return { name: 'Pinterest', icon: pinterestIcon };
    case 'facebook':
      return { name: 'Facebook', icon: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg' };
    case 'spotify':
      return { name: 'Spotify', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg' };
    case 'quora':
      return { name: 'Quora', icon: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Quora_logo_2015.svg' };
    case 'medium':
      return { name: 'Medium', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Medium_logo_Monogram.svg' };
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

  const handleVideoClick = () => {
    if (post.mediaType === 'video' && post.platform === 'youtube' && post.mediaUrl) {
      setIsPlayingVideo(true);
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

  const { isLiked, isSaved, toggleLike, toggleSave, handleShare, deletePost, isDeleting } = postActions;

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
                className={`object-contain ${detectedPlatform === 'facebook' || detectedPlatform === 'quora' ? 'w-6 h-6' : 'w-8 h-8'}`}
              />
            )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {post.isRealPost && (post as any).user_id === userId && (
                    <DropdownMenuItem 
                      onClick={() => deletePost()}
                      disabled={isDeleting}
                      className="text-destructive focus:text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
            <button className="p-2 hover:opacity-60 transition-opacity">
              <Repeat2 className="h-8 w-8 stroke-[2.5]" />
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
                className={`object-contain ${detectedPlatform === 'facebook' || detectedPlatform === 'quora' ? 'w-6 h-6' : 'w-8 h-8'}`}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {post.isRealPost && (post as any).user_id === userId && (
                  <DropdownMenuItem 
                    onClick={() => deletePost()}
                    disabled={isDeleting}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
            {r.kind === 'raw' && <RawEmbedRenderer embedHtml={r.html} />}
            {r.kind === 'reddit' && <RedditEmbed url={r.url} />}
            {r.kind === 'twitter' && <TwitterEmbed url={r.url} />}
            {r.kind === 'pinterest' && <PinterestEmbed url={r.url} />}
            {r.kind === 'article' && <ArticleEmbed url={r.url} onFaviconLoaded={setBlogFavicon} />}
            {r.kind === 'universal' && <UniversalMetaEmbed url={r.url} />}
            {r.kind === 'image' && (
              <div className="rounded-2xl overflow-hidden">
                <img 
                  src={r.url} 
                  alt="Post content" 
                  className="w-full h-auto object-cover aspect-video" 
                />
              </div>
            )}
            {r.kind === 'video' && post.platform === 'youtube' && (
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
                  <>
                    <div className="absolute inset-0">
                      <img 
                        src={getYouTubeThumbnail(r.url)} 
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={handleVideoClick}
                      className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer group"
                    >
                      <div className="h-20 w-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/70 transition-all">
                        <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent ml-1"></div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
            {r.kind === 'video' && post.platform !== 'youtube' && (
              <div className="rounded-2xl overflow-hidden">
                <video src={r.url} className="w-full h-auto" controls playsInline />
              </div>
            )}
          </div>
        )}

        {/* Title - hide for Reddit embeds as they contain their own title */}
        {r.kind !== 'reddit' && (
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
          <button className="p-2 hover:opacity-60 transition-opacity">
            <Repeat2 className="h-8 w-8 stroke-[2.5]" />
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
