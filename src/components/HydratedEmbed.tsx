import { useState, memo, useCallback, useEffect, useRef } from 'react';
import { useMediaPauseOnScroll } from '@/hooks/useMediaPauseOnScroll';
import type { Post } from '@/data/demoData';
import { TwitterEmbed } from '@/components/embeds/TwitterEmbed';
import { PinterestEmbed } from '@/components/embeds/PinterestEmbed';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
import { ArticleEmbed } from '@/features/article-embeds';
import RedditEmbed from '@/components/embeds/RedditEmbed';
import { ImageViewTracker } from '@/components/ImageViewTracker';
import { MediaSuspendOverlay } from '@/components/MediaSuspendOverlay';

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
  const previousLifecycleStateRef = useRef<'active' | 'paused' | 'suspended'>('active');
  const resumeMaskTimeoutRef = useRef<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [rawEmbedFailed, setRawEmbedFailed] = useState(false);
  const [resumeMaskVisible, setResumeMaskVisible] = useState(false);
  const shouldHydrate = isHydrated || hydratedPostIds.has(post.id);
  const mediaUrl = post.mediaUrl || (post as any).media_url || r.url;
  const platformHint = (post.platform || '').toLowerCase();
  const mediaTypeHint = String((post as any).mediaType || (post as any).media_type || '').toLowerCase();
  const lowerUrl = (mediaUrl || '').toLowerCase();

  // Enable auto-pause for ALL playable media posts. CSS-only suppression
  // (pointer-events, aria-hidden, tabIndex) is used for non-API platforms —
  // no iframe src mutations, so no flicker or reload.
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
    platformHint === 'tiktok' ||
    lowerUrl.includes('youtube.com/') ||
    lowerUrl.includes('youtube-nocookie.com/') ||
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

  const supportsDirectPause =
    mediaTypeHint === 'video' ||
    mediaTypeHint === 'audio' ||
    r.kind === 'video' ||
    platformHint === 'youtube' ||
    platformHint === 'spotify' ||
    lowerUrl.includes('youtube.com/') ||
    lowerUrl.includes('youtube-nocookie.com/') ||
    lowerUrl.includes('youtu.be/') ||
    lowerUrl.includes('open.spotify.com/');

  const shouldHardSuspendOnPause = mediaLifecycleEnabled && !supportsDirectPause;

  const lifecycleState = useMediaPauseOnScroll(
    embedContainerRef,
    `${post.id}:${shouldHydrate ? 'hydrated' : 'placeholder'}:${r.kind}`,
    {
      enabled: mediaLifecycleEnabled,
      hardSuspendDistanceVh: 6,
      disableHardSuspend: !shouldHardSuspendOnPause,
      hardSuspendOnPause: shouldHardSuspendOnPause,
    }
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

  useEffect(() => {
    return () => {
      if (resumeMaskTimeoutRef.current !== null) {
        window.clearTimeout(resumeMaskTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const clearResumeTimeout = () => {
      if (resumeMaskTimeoutRef.current !== null) {
        window.clearTimeout(resumeMaskTimeoutRef.current);
        resumeMaskTimeoutRef.current = null;
      }
    };

    if (!shouldHardSuspendOnPause) {
      clearResumeTimeout();
      setResumeMaskVisible(false);
      previousLifecycleStateRef.current = lifecycleState;
      return;
    }

    const previousState = previousLifecycleStateRef.current;
    let releaseMask: (() => void) | null = null;

    if (lifecycleState !== 'active') {
      clearResumeTimeout();
      setResumeMaskVisible(true);
    } else if (previousState !== 'active') {
      const root = embedContainerRef.current;
      const iframes = root ? Array.from(root.querySelectorAll<HTMLIFrameElement>('iframe')) : [];
      let isReleased = false;

      const settleMask = () => {
        if (isReleased) return;
        isReleased = true;
        clearResumeTimeout();
        setResumeMaskVisible(false);
        iframes.forEach((iframe) => iframe.removeEventListener('load', handleLoad));
      };

      const handleLoad = () => {
        window.requestAnimationFrame(() => settleMask());
      };

      setResumeMaskVisible(true);

      if (!iframes.length) {
        resumeMaskTimeoutRef.current = window.setTimeout(() => {
          setResumeMaskVisible(false);
          resumeMaskTimeoutRef.current = null;
        }, 180);
      } else {
        iframes.forEach((iframe) => iframe.addEventListener('load', handleLoad));
        resumeMaskTimeoutRef.current = window.setTimeout(settleMask, 1200);
        releaseMask = settleMask;
      }
    } else {
      clearResumeTimeout();
      setResumeMaskVisible(false);
    }

    previousLifecycleStateRef.current = lifecycleState;

    return () => {
      releaseMask?.();
    };
  }, [lifecycleState, shouldHardSuspendOnPause]);

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
  const showSuspendOverlay = shouldHardSuspendOnPause && (lifecycleState !== 'active' || resumeMaskVisible);
  
  
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
      <div ref={embedContainerRef} className={`relative w-full bg-muted ${aspectClass}`}>
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
    <div ref={embedContainerRef} className="relative w-full" style={{ contain: 'layout paint' }}>
      <MediaSuspendOverlay visible={showSuspendOverlay} thumbnailUrl={effectiveThumbnail} />
      <div className="w-full">

        {/* YouTube video */}
        {r.kind === 'video' && post.platform === 'youtube' && r.url && (
          <div className={`w-full bg-black ${aspectClass}`}>
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=0&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
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

        {/* Fallback routing for legacy raw payloads */}
        {forceTwitterRenderer && mediaUrl && (
          <ImageViewTracker postId={post.id}>
            <TwitterEmbed url={mediaUrl} />
          </ImageViewTracker>
        )}

        {forcePinterestRenderer && mediaUrl && (
          <ImageViewTracker postId={post.id}>
            <PinterestEmbed url={mediaUrl} />
          </ImageViewTracker>
        )}

        {forceUniversalRenderer && mediaUrl && (
          <ImageViewTracker postId={post.id}>
            <UniversalMetaEmbed url={mediaUrl} />
          </ImageViewTracker>
        )}
        
        {/* Raw embed HTML (Instagram, Facebook, Spotify) */}
        {r.kind === 'raw' && !forceTwitterRenderer && !forcePinterestRenderer && !forceUniversalRenderer && r.html && !rawEmbedFailed && (
          <ImageViewTracker postId={post.id}>
            <RawEmbedRenderer embedHtml={r.html} onError={handleRawEmbedError} />
          </ImageViewTracker>
        )}

        {/* Fallback when raw embed fails — show UniversalMetaEmbed to rebuild */}
        {r.kind === 'raw' && !forceTwitterRenderer && !forcePinterestRenderer && !forceUniversalRenderer && rawEmbedFailed && post.mediaUrl && (
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
    </div>
  );
});

HydratedEmbed.displayName = 'HydratedEmbed';
