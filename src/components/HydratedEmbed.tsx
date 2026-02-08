import { useState, useCallback, memo } from 'react';
import { Play } from 'lucide-react';
import type { Post } from '@/data/demoData';
import { TwitterEmbed } from '@/components/embeds/TwitterEmbed';
import { PinterestEmbed } from '@/components/embeds/PinterestEmbed';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
import { ArticleEmbed } from '@/features/article-embeds';
import RedditEmbed from '@/components/embeds/RedditEmbed';
import { ImageViewTracker } from '@/components/ImageViewTracker';

interface RendererResult {
  kind: 'raw' | 'reddit' | 'twitter' | 'pinterest' | 'article' | 'universal' | 'image' | 'video' | 'none';
  html?: string;
  url?: string;
}

interface HydratedEmbedProps {
  post: Post & { isRealPost?: boolean };
  renderer: RendererResult;
  thumbnailUrl?: string | null;
  isHydrated: boolean;
  onPlayClick: () => void;
}

const getYouTubeVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const isYouTubeShort = (url: string) => url.includes('/shorts/');

const getYouTubeThumbnail = (url: string) => {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
};

export const HydratedEmbed = memo(({ 
  post, 
  renderer: r, 
  thumbnailUrl, 
  isHydrated, 
  onPlayClick 
}: HydratedEmbedProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // For YouTube, prefer their thumbnail
  const effectiveThumbnail = post.platform === 'youtube' && r.url 
    ? getYouTubeThumbnail(r.url) || thumbnailUrl 
    : thumbnailUrl;
  
  const aspectClass = post.platform === 'youtube' && r.url && isYouTubeShort(r.url)
    ? 'aspect-[9/16]'
    : 'aspect-video';
  
  // If no renderer or none type, show nothing
  if (r.kind === 'none') return null;
  
  // THUMBNAIL STATE: Show high-res thumbnail with play button overlay
  if (!isHydrated) {
    return (
      <div 
        className={`relative w-full bg-muted cursor-pointer overflow-hidden ${aspectClass}`}
        onClick={onPlayClick}
      >
        {/* Shimmer placeholder while loading */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-shimmer" />
        )}
        
        {/* High-res thumbnail - edge to edge */}
        {effectiveThumbnail && !imageError && (
          <img
            src={effectiveThumbnail}
            alt="Content preview"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="eager"
            decoding="async"
          />
        )}
        
        {/* Fallback gradient if no thumbnail */}
        {(!effectiveThumbnail || imageError) && (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/20" />
        )}
        
        {/* Subtle play button overlay - only for video/embed content */}
        {(r.kind === 'video' || r.kind === 'raw' || r.kind === 'twitter' || 
          r.kind === 'reddit' || r.kind === 'pinterest' || r.kind === 'universal') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group">
            <div className="bg-white/90 dark:bg-black/70 backdrop-blur-sm rounded-full p-4 shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-foreground fill-current" />
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // HYDRATED STATE: Show the actual embed with fade-in animation
  return (
    <div className="w-full animate-fade-in">
      {/* YouTube video */}
      {r.kind === 'video' && post.platform === 'youtube' && r.url && (
        <div className={`w-full bg-black ${aspectClass}`}>
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=1&mute=0&playsinline=1&rel=0`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
      
      {/* Non-YouTube video */}
      {r.kind === 'video' && post.platform !== 'youtube' && r.url && (
        <video 
          src={r.url} 
          className="w-full h-auto" 
          controls 
          autoPlay
          playsInline
        />
      )}
      
      {/* Image content */}
      {r.kind === 'image' && r.url && (
        <ImageViewTracker postId={post.id}>
          <img 
            src={r.url} 
            alt="Post content" 
            className="w-full h-auto object-cover" 
          />
        </ImageViewTracker>
      )}
      
      {/* Raw embed HTML */}
      {r.kind === 'raw' && r.html && (
        <ImageViewTracker postId={post.id}>
          <RawEmbedRenderer embedHtml={r.html} />
        </ImageViewTracker>
      )}
      
      {/* Twitter/X embed */}
      {r.kind === 'twitter' && r.url && (
        <ImageViewTracker postId={post.id}>
          <TwitterEmbed url={r.url} />
        </ImageViewTracker>
      )}
      
      {/* Reddit embed */}
      {r.kind === 'reddit' && r.url && (
        <ImageViewTracker postId={post.id}>
          <RedditEmbed url={r.url} />
        </ImageViewTracker>
      )}
      
      {/* Pinterest embed */}
      {r.kind === 'pinterest' && r.url && (
        <ImageViewTracker postId={post.id}>
          <PinterestEmbed url={r.url} />
        </ImageViewTracker>
      )}
      
      {/* Article embed */}
      {r.kind === 'article' && r.url && (
        <ImageViewTracker postId={post.id}>
          <ArticleEmbed url={r.url} />
        </ImageViewTracker>
      )}
      
      {/* Universal Meta embed (Instagram, Facebook, etc) */}
      {r.kind === 'universal' && r.url && (
        <ImageViewTracker postId={post.id}>
          <UniversalMetaEmbed url={r.url} />
        </ImageViewTracker>
      )}
    </div>
  );
});

HydratedEmbed.displayName = 'HydratedEmbed';
