import { useState, memo } from 'react';
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
  
  // IMAGES: Load directly without play button (swift loading)
  if (r.kind === 'image' && r.url) {
    return (
      <ImageViewTracker postId={post.id}>
        <img 
          src={r.url} 
          alt="Post content" 
          className="w-full h-auto object-cover" 
          loading="eager"
          decoding="async"
        />
      </ImageViewTracker>
    );
  }
  
  // THUMBNAIL PLACEHOLDER: Shows while waiting for auto-hydration
  if (!isHydrated) {
    return (
      <div className={`relative w-full bg-muted overflow-hidden ${aspectClass}`}>
        {/* Animated shimmer overlay */}
        <div className="absolute inset-0 z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent animate-[shimmer_1.8s_ease-in-out_infinite]" 
               style={{ backgroundSize: '200% 100%' }} />
        </div>
        {effectiveThumbnail && !imageError ? (
          <img
            src={effectiveThumbnail}
            alt="Content preview"
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
          </div>
        )}
      </div>
    );
  }
  
  // HYDRATED STATE: Show the actual embed with smooth crossfade
  return (
    <div className="w-full animate-[embedReveal_0.5s_ease-out_forwards]">
      {/* YouTube video */}
      {r.kind === 'video' && post.platform === 'youtube' && r.url && (
        <div className={`w-full bg-black ${aspectClass}`}>
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=0&playsinline=1&rel=0`}
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
