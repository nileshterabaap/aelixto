import { useState, memo, useCallback, useEffect, useRef } from 'react';
import type { Post } from '@/data/demoData';
import { TwitterEmbed } from '@/components/embeds/TwitterEmbed';
import { PinterestEmbed } from '@/components/embeds/PinterestEmbed';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
import { ArticleEmbed } from '@/features/article-embeds';
import RedditEmbed from '@/components/embeds/RedditEmbed';
import { ImageViewTracker } from '@/components/ImageViewTracker';
import { SkeletonGate } from '@/components/embeds/SkeletonGate';

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
  const [rawEmbedFailed, setRawEmbedFailed] = useState(false);

  const handleRawEmbedError = useCallback(() => {
    setRawEmbedFailed(true);
  }, []);
  
  // For YouTube, prefer their thumbnail
  const effectiveThumbnail = post.platform === 'youtube' && r.url 
    ? getYouTubeThumbnail(r.url) || thumbnailUrl 
    : thumbnailUrl;
  
  const aspectClass = post.platform === 'youtube' && r.url && isYouTubeShort(r.url)
    ? 'aspect-[9/16]'
    : 'aspect-video';
  
  // If no renderer or none type, show nothing (no placeholder/skeleton either)
  if (r.kind === 'none') return null;

  const rawUniversalUrl = ((post.mediaUrl || (post as any).media_url) ?? '').trim();
  const normalizedPlatform = (post.platform || '').toLowerCase();
  const rawHtmlSuggestsIframePlatform =
    r.kind === 'raw' &&
    !!r.html &&
    (r.html.includes('instagram.com') ||
      r.html.includes('facebook.com') ||
      r.html.includes('fb.watch') ||
      r.html.includes('threads.net') ||
      r.html.includes('threads.com'));
  const rawEmbedCanUseUniversal =
    r.kind === 'raw' &&
    !!rawUniversalUrl &&
    (['instagram', 'facebook', 'threads'].includes(normalizedPlatform) || rawHtmlSuggestsIframePlatform);
  
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
      <div className={`relative w-full bg-muted ${aspectClass}`}>
        {effectiveThumbnail && !imageError ? (
          <img
            src={effectiveThumbnail}
            alt="Content preview"
            className={`w-full h-full object-cover transition-opacity duration-200 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full animate-pulse bg-muted" />
        )}
      </div>
    );
  }
  
  // HYDRATED STATE: Show skeleton → fade into actual embed
  return (
    <div className="w-full" style={{ contain: 'layout paint' }}>
      {/* YouTube video */}
      {r.kind === 'video' && post.platform === 'youtube' && r.url && (
        <SkeletonGate platform="youtube">
          <div className={`w-full bg-black ${aspectClass}`}>
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=0&playsinline=1&rel=0`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </SkeletonGate>
      )}
      
      {/* Non-YouTube video */}
      {r.kind === 'video' && post.platform !== 'youtube' && r.url && (
        <SkeletonGate platform={post.platform || undefined}>
          <video 
            src={r.url} 
            className="w-full h-auto" 
            controls 
            autoPlay
            playsInline
          />
        </SkeletonGate>
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
      
      {/* Raw embed HTML: route SDK-heavy platforms to direct iframe path */}
      {r.kind === 'raw' && rawEmbedCanUseUniversal && rawUniversalUrl && (
        <SkeletonGate platform={post.platform || undefined}>
          <ImageViewTracker postId={post.id}>
            <UniversalMetaEmbed url={rawUniversalUrl} />
          </ImageViewTracker>
        </SkeletonGate>
      )}

      {r.kind === 'raw' && r.html && !rawEmbedFailed && !rawEmbedCanUseUniversal && (
        <SkeletonGate platform={post.platform || undefined}>
          <ImageViewTracker postId={post.id}>
            <RawEmbedRenderer embedHtml={r.html} onError={handleRawEmbedError} />
          </ImageViewTracker>
        </SkeletonGate>
      )}

      {/* Fallback when raw embed fails — show UniversalMetaEmbed to rebuild */}
      {r.kind === 'raw' && rawEmbedFailed && post.mediaUrl && (
        <ImageViewTracker postId={post.id}>
          <UniversalMetaEmbed url={post.mediaUrl} />
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
        <SkeletonGate platform="reddit">
          <ImageViewTracker postId={post.id}>
            <RedditEmbed url={r.url} />
          </ImageViewTracker>
        </SkeletonGate>
      )}
      
      {/* Pinterest embed */}
      {r.kind === 'pinterest' && r.url && (
        <ImageViewTracker postId={post.id}>
          <PinterestEmbed url={r.url} />
        </ImageViewTracker>
      )}
      
      {/* Article embed */}
      {r.kind === 'article' && r.url && (
        <SkeletonGate platform={post.platform || 'blog'}>
          <ImageViewTracker postId={post.id}>
            <ArticleEmbed url={r.url} />
          </ImageViewTracker>
        </SkeletonGate>
      )}
      
      {/* Universal Meta embed (Instagram, Facebook, etc) */}
      {r.kind === 'universal' && r.url && (
        <SkeletonGate platform={post.platform || undefined}>
          <ImageViewTracker postId={post.id}>
            <UniversalMetaEmbed url={r.url} />
          </ImageViewTracker>
        </SkeletonGate>
      )}
    </div>
  );
});

HydratedEmbed.displayName = 'HydratedEmbed';
