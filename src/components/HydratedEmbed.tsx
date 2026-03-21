import { useState, memo, useCallback, useEffect, useRef } from 'react';
import { useMediaPauseOnScroll } from '@/hooks/useMediaPauseOnScroll';
import { useInView } from '@/hooks/useInView';
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

const HYDRATED_CACHE_LIMIT = 800;
const hydratedPostIds = new Set<string>();
const hydratedPostQueue: string[] = [];

const rememberHydratedPost = (postId: string) => {
  if (hydratedPostIds.has(postId)) return;

  hydratedPostIds.add(postId);
  hydratedPostQueue.push(postId);

  if (hydratedPostQueue.length > HYDRATED_CACHE_LIMIT) {
    const oldestPostId = hydratedPostQueue.shift();
    if (oldestPostId) {
      hydratedPostIds.delete(oldestPostId);
    }
  }
};

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
  const embedContainerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [rawEmbedFailed, setRawEmbedFailed] = useState(false);
  const shouldHydrate = isHydrated || hydratedPostIds.has(post.id);
  const mediaUrl = post.mediaUrl || (post as any).media_url || r.url;
  const platformHint = (post.platform || '').toLowerCase();
  const mediaTypeHint = String((post as any).mediaType || (post as any).media_type || '').toLowerCase();
  const lowerUrl = (mediaUrl || '').toLowerCase();

  // Track if embed is mostly off-screen (< 20% visible) for overlay
  const isInView = useInView(embedContainerRef, { threshold: 0.2 });

  const isPlayableMediaPost =
    mediaTypeHint === 'video' ||
    mediaTypeHint === 'audio' ||
    r.kind === 'video' ||
    platformHint === 'youtube' ||
    platformHint === 'spotify' ||
    platformHint === 'instagram' ||
    platformHint === 'facebook' ||
    platformHint === 'linkedin' ||
    platformHint === 'threads' ||
    platformHint === 'pinterest' ||
    platformHint === 'twitter' ||
    platformHint === 'x' ||
    lowerUrl.includes('youtube.com/') ||
    lowerUrl.includes('youtu.be/') ||
    lowerUrl.includes('open.spotify.com/') ||
    lowerUrl.includes('tiktok.com/') ||
    lowerUrl.includes('instagram.com/') ||
    lowerUrl.includes('facebook.com/') ||
    lowerUrl.includes('fb.watch/') ||
    lowerUrl.includes('linkedin.com/') ||
    lowerUrl.includes('threads.net/') ||
    lowerUrl.includes('threads.com/') ||
    lowerUrl.includes('pinterest.com/') ||
    lowerUrl.includes('pin.it/') ||
    lowerUrl.includes('twitter.com/') ||
    lowerUrl.includes('x.com/') ||
    lowerUrl.includes('/reel/') ||
    lowerUrl.includes('/shorts/') ||
    lowerUrl.includes('/video/');

  const mediaLifecycleEnabled =
    shouldHydrate &&
    (isPlayableMediaPost ||
      r.kind === 'raw' ||
      r.kind === 'twitter' ||
      r.kind === 'universal' ||
      r.kind === 'pinterest');

  useMediaPauseOnScroll(
    embedContainerRef,
    `${post.id}:${shouldHydrate ? 'hydrated' : 'placeholder'}:${r.kind}`,
    { enabled: mediaLifecycleEnabled, hardSuspendDistanceVh: 6, disableHardSuspend: true }
  );

  const forceTwitterRenderer =
    r.kind === 'raw' &&
    !!mediaUrl &&
    (platformHint === 'twitter' || platformHint === 'x' || lowerUrl.includes('twitter.com/') || lowerUrl.includes('x.com/'));
  const forcePinterestRenderer =
    r.kind === 'raw' &&
    !!mediaUrl &&
    (platformHint === 'pinterest' || lowerUrl.includes('pinterest.com/') || lowerUrl.includes('pin.it/'));
  const forceUniversalRenderer =
    r.kind === 'raw' &&
    !!mediaUrl &&
    (platformHint === 'threads' || platformHint === 'linkedin' || lowerUrl.includes('threads.net/') || lowerUrl.includes('threads.com/') || lowerUrl.includes('linkedin.com/'));

  useEffect(() => {
    if (!shouldHydrate) return;
    rememberHydratedPost(post.id);
  }, [post.id, shouldHydrate]);


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
  
  // IMAGES: Load directly without play button (swift loading)
  if (r.kind === 'image' && r.url) {
    return (
      <div ref={embedContainerRef} className="w-full">
        <ImageViewTracker postId={post.id}>
          <img 
            src={r.url} 
            alt="Post content" 
            className="w-full h-auto object-cover" 
            loading="eager"
            decoding="async"
          />
        </ImageViewTracker>
      </div>
    );
  }
  
  // THUMBNAIL PLACEHOLDER: Shows while waiting for auto-hydration
  if (!shouldHydrate) {
    return (
      <div ref={embedContainerRef} className={`relative w-full bg-muted ${aspectClass} cursor-pointer`} onClick={onPlayClick}>
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
        {/* Play button overlay */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm grid place-items-center">
            <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[11px] border-t-transparent border-b-[11px] border-b-transparent ml-1" />
          </div>
        </div>
      </div>
    );
  }
  
  // Determine if this is a non-API embed (can't be paused programmatically)
  const isNonApiEmbed =
    r.kind === 'raw' ||
    r.kind === 'universal' ||
    r.kind === 'reddit' ||
    r.kind === 'article' ||
    (r.kind === 'twitter') ||
    (r.kind === 'pinterest') ||
    // Also catch forced renderers
    forceTwitterRenderer ||
    forcePinterestRenderer ||
    forceUniversalRenderer;

  // Show dim overlay when scrolled away for non-API embeds
  const showScrolledAwayOverlay = shouldHydrate && !isInView && isNonApiEmbed;

  // HYDRATED STATE: Show skeleton → fade into actual embed
  return (
    <div ref={embedContainerRef} className="relative w-full" style={{ contain: 'layout paint' }}>
      <div className="w-full">

        {/* YouTube video */}
        {r.kind === 'video' && post.platform === 'youtube' && r.url && (
          <SkeletonGate platform="youtube" cacheKey={`${post.id}:youtube-video`}>
            <div className={`w-full bg-black ${aspectClass}`}>
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=0&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </SkeletonGate>
        )}
        
        {/* Non-YouTube video */}
        {r.kind === 'video' && post.platform !== 'youtube' && r.url && (
          <SkeletonGate platform={post.platform || undefined} cacheKey={`${post.id}:native-video`}>
            <video 
              src={r.url} 
              className="w-full h-auto" 
              controls 
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

        {/* Fallback routing for legacy raw payloads */}
        {forceTwitterRenderer && mediaUrl && (
          <SkeletonGate platform="twitter" cacheKey={`${post.id}:twitter-forced`}>
            <ImageViewTracker postId={post.id}>
              <TwitterEmbed url={mediaUrl} />
            </ImageViewTracker>
          </SkeletonGate>
        )}

        {forcePinterestRenderer && mediaUrl && (
          <SkeletonGate platform="pinterest" cacheKey={`${post.id}:pinterest-forced`}>
            <ImageViewTracker postId={post.id}>
              <PinterestEmbed url={mediaUrl} />
            </ImageViewTracker>
          </SkeletonGate>
        )}

        {forceUniversalRenderer && mediaUrl && (
          <SkeletonGate platform={post.platform || undefined} cacheKey={`${post.id}:universal-forced`}>
            <ImageViewTracker postId={post.id}>
              <UniversalMetaEmbed url={mediaUrl} />
            </ImageViewTracker>
          </SkeletonGate>
        )}
        
        {/* Raw embed HTML (Instagram, Facebook, Spotify) */}
        {r.kind === 'raw' && !forceTwitterRenderer && !forcePinterestRenderer && !forceUniversalRenderer && r.html && !rawEmbedFailed && (
          <SkeletonGate platform={post.platform || undefined} cacheKey={`${post.id}:raw`}>
            <ImageViewTracker postId={post.id}>
              <RawEmbedRenderer embedHtml={r.html} onError={handleRawEmbedError} />
            </ImageViewTracker>
          </SkeletonGate>
        )}

        {/* Fallback when raw embed fails — show UniversalMetaEmbed to rebuild */}
        {r.kind === 'raw' && !forceTwitterRenderer && !forcePinterestRenderer && !forceUniversalRenderer && rawEmbedFailed && post.mediaUrl && (
          <ImageViewTracker postId={post.id}>
            <UniversalMetaEmbed url={post.mediaUrl} />
          </ImageViewTracker>
        )}
        
        {/* Twitter/X embed */}
        {r.kind === 'twitter' && r.url && (
          <SkeletonGate platform="twitter" cacheKey={`${post.id}:twitter`}>
            <ImageViewTracker postId={post.id}>
              <TwitterEmbed url={r.url} />
            </ImageViewTracker>
          </SkeletonGate>
        )}
        
        {/* Reddit embed */}
        {r.kind === 'reddit' && r.url && (
          <SkeletonGate platform="reddit" cacheKey={`${post.id}:reddit`}>
            <ImageViewTracker postId={post.id}>
              <RedditEmbed url={r.url} />
            </ImageViewTracker>
          </SkeletonGate>
        )}
        
        {/* Pinterest embed */}
        {r.kind === 'pinterest' && r.url && (
          <SkeletonGate platform="pinterest" cacheKey={`${post.id}:pinterest`}>
            <ImageViewTracker postId={post.id}>
              <PinterestEmbed url={r.url} />
            </ImageViewTracker>
          </SkeletonGate>
        )}
        
        {/* Article embed */}
        {r.kind === 'article' && r.url && (
          <SkeletonGate platform={post.platform || 'blog'} cacheKey={`${post.id}:article`}>
            <ImageViewTracker postId={post.id}>
              <ArticleEmbed url={r.url} />
            </ImageViewTracker>
          </SkeletonGate>
        )}
        
        {/* Universal Meta embed (Instagram, Facebook, etc) */}
        {r.kind === 'universal' && r.url && (
          <SkeletonGate platform={post.platform || undefined} cacheKey={`${post.id}:universal`}>
            <ImageViewTracker postId={post.id}>
              <UniversalMetaEmbed url={r.url} />
            </ImageViewTracker>
          </SkeletonGate>
        )}
      </div>

      {/* Dim overlay for non-API embeds when scrolled away — blocks interaction without disrupting layout */}
      {showScrolledAwayOverlay && (
        <div
          className="absolute inset-0 bg-background/60 pointer-events-auto transition-opacity duration-300 opacity-100"
          aria-hidden="true"
        />
      )}
    </div>
  );
});

HydratedEmbed.displayName = 'HydratedEmbed';
