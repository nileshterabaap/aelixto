import { useState, memo, useCallback, useEffect, useRef } from 'react';
import type { Post } from '@/data/demoData';
import { TwitterEmbed } from '@/components/embeds/TwitterEmbed';
import { ThreadsEmbed } from '@/components/embeds/ThreadsEmbed';
import { PinterestEmbed } from '@/components/embeds/PinterestEmbed';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
import { ArticleEmbed } from '@/features/article-embeds';
import RedditEmbed from '@/components/embeds/RedditEmbed';
import { ImageViewTracker } from '@/components/ImageViewTracker';
import { EmbedSkeleton } from '@/components/EmbedSkeleton';

interface RendererResult {
  kind: 'raw' | 'reddit' | 'twitter' | 'threads' | 'pinterest' | 'article' | 'universal' | 'image' | 'video' | 'none';
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

const MIN_SKELETON_MS = 200;

/**
 * Wrapper that guarantees a skeleton shows for at least MIN_SKELETON_MS,
 * then fades smoothly into the real content.
 */
const SkeletonGate = ({
  platform,
  children,
}: {
  platform?: string;
  children: React.ReactNode;
}) => {
  const [ready, setReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    const remaining = MIN_SKELETON_MS - (Date.now() - mountTime.current);
    const timer = setTimeout(() => setMinElapsed(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, []);

  // Content signals it's ready via a MutationObserver (iframe appeared)
  // or after a reasonable timeout
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check immediately
    const check = () => {
      if (el.querySelector('iframe, img, .twitter-embed-container *, .pinterest-embed-container *')) {
        setReady(true);
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => { check(); });
    observer.observe(el, { childList: true, subtree: true });

    // Fallback: mark ready after 5s regardless
    const fallback = setTimeout(() => setReady(true), 5000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  const showContent = ready && minElapsed;

  return (
    <div className="relative w-full">
      {/* Skeleton layer */}
      <div
        className={`transition-opacity duration-300 ${showContent ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'}`}
      >
        <EmbedSkeleton platform={platform} />
      </div>
      {/* Content layer - always mounted so embeds can initialize */}
      <div
        ref={containerRef}
        className={`transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
      >
        {children}
      </div>
    </div>
  );
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
      <div className={`relative w-full bg-black ${aspectClass}`}>
        {effectiveThumbnail && !imageError && (
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
        )}
      </div>
    );
  }
  
  // HYDRATED STATE: Show skeleton → fade into actual embed
  return (
    <div className="w-full">
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
      
      {/* Raw embed HTML (Instagram, Facebook, Spotify) */}
      {r.kind === 'raw' && r.html && (
        <SkeletonGate platform={post.platform || undefined}>
          <ImageViewTracker postId={post.id}>
            <RawEmbedRenderer embedHtml={r.html} />
          </ImageViewTracker>
        </SkeletonGate>
      )}
      
      {/* Twitter/X embed */}
      {r.kind === 'twitter' && r.url && (
        <SkeletonGate platform="twitter">
          <ImageViewTracker postId={post.id}>
            <TwitterEmbed url={r.url} />
          </ImageViewTracker>
        </SkeletonGate>
      )}
      
      {/* Threads embed */}
      {r.kind === 'threads' && r.url && (
        <SkeletonGate platform="threads">
          <ImageViewTracker postId={post.id}>
            <ThreadsEmbed url={r.url} />
          </ImageViewTracker>
        </SkeletonGate>
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
        <SkeletonGate platform="pinterest">
          <ImageViewTracker postId={post.id}>
            <PinterestEmbed url={r.url} />
          </ImageViewTracker>
        </SkeletonGate>
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
