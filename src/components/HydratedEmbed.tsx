import { useState, memo, useCallback, useEffect, useRef, type MouseEvent } from 'react';
import { useMediaPauseOnScroll } from '@/hooks/useMediaPauseOnScroll';
import { useOriginalVisitTracker } from '@/hooks/useOriginalVisitTracker';
import { useEmbedEngagementFallback } from '@/hooks/useEmbedEngagementFallback';
import type { Post } from '@/data/demoData';
import { supabase } from '@/integrations/supabase/client';
import { TwitterEmbed } from '@/components/embeds/TwitterEmbed';
import { PinterestEmbed } from '@/components/embeds/PinterestEmbed';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { ThreadsAwareMetaEmbed as UniversalMetaEmbed } from '@/components/ThreadsAwareMetaEmbed';
import { ArticleEmbed } from '@/features/article-embeds';
import RedditEmbed from '@/components/embeds/RedditEmbed';
import { ImageViewTracker } from '@/components/ImageViewTracker';
import { markOriginalVisit } from '@/hooks/useOriginalVisitTracker';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { useHasPostBeenPlayed } from '@/lib/playedPosts';

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

// Session-scoped guard to avoid spamming the validator for the same post
const validationRequested = new Set<string>();
const requestSourceValidation = (postId: string) => {
  if (!postId || validationRequested.has(postId)) return;
  validationRequested.add(postId);
  // Fire-and-forget; server side enforces the 2-strike gate before any deletion
  supabase.functions.invoke('validate-post-source', { body: { postId } }).catch(() => {});
};

const getYouTubeVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const isYouTubeShort = (
  url: string,
  title?: string | null,
  content?: string | null,
  aspectRatio?: number | null,
  mediaKind?: string | null,
) => {
  const normalizedUrl = decodeURIComponent(url).toLowerCase();
  if (normalizedUrl.includes('/shorts/')) return true;
  if (title && /#shorts?\b/i.test(title)) return true;
  if (content && /#shorts?\b/i.test(content)) return true;
  if (typeof aspectRatio === 'number' && aspectRatio > 0 && aspectRatio < 1) return true;
  if (mediaKind && /short|reel|vertical|portrait/i.test(mediaKind)) return true;
  return false;
};

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
  const mediaKindHint = String((post as any).media_kind || (post as any).mediaKind || '').toLowerCase();
  const lowerUrl = (mediaUrl || '').toLowerCase();

  const isPlayableMediaPost =
    mediaTypeHint === 'video' ||
    mediaTypeHint === 'audio' ||
    mediaKindHint === 'video' ||
    mediaKindHint === 'reel' ||
    mediaKindHint === 'short' ||
    mediaKindHint === 'clip' ||
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
    lowerUrl.includes('player.vimeo.com/') ||
    lowerUrl.includes('vimeo.com/') ||
    lowerUrl.includes('dailymotion.com/') ||
    lowerUrl.includes('streamable.com/') ||
    lowerUrl.includes('player.twitch.tv/') ||
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

  // Hard-suspend + pre-warm only matters for VIDEO posts the user actually played.
  // Images/text/never-played embeds just load normally and stay put (no reload traffic).
  const isNonVideoPost =
    mediaTypeHint === 'image' ||
    mediaTypeHint === 'photo' ||
    mediaTypeHint === 'text' ||
    mediaTypeHint === 'article' ||
    mediaTypeHint === 'link';

  const hasBeenPlayed = useHasPostBeenPlayed(post.id);

  const isVideoPost =
    !isNonVideoPost &&
    (mediaTypeHint === 'video' ||
      mediaKindHint === 'video' ||
      mediaKindHint === 'reel' ||
      mediaKindHint === 'short' ||
      mediaKindHint === 'clip' ||
      r.kind === 'video' ||
      lowerUrl.includes('/reel/') ||
      lowerUrl.includes('/reels/') ||
      lowerUrl.includes('/shorts/') ||
      lowerUrl.includes('/video/') ||
      lowerUrl.includes('/clips/') ||
      lowerUrl.includes('youtube.com/') ||
      lowerUrl.includes('youtu.be/') ||
      lowerUrl.includes('tiktok.com/') ||
      lowerUrl.includes('fb.watch/') ||
      lowerUrl.includes('vimeo.com/') ||
      lowerUrl.includes('dailymotion.com/') ||
      lowerUrl.includes('streamable.com/') ||
      lowerUrl.includes('player.twitch.tv/') ||
      // Generated platform iframe URLs often hide the media type. A confirmed
      // video_play event is authoritative proof that this post is a video —
      // regardless of platform (Reddit, TikTok, Vimeo, Twitch, etc.).
      hasBeenPlayed);

  useMediaPauseOnScroll(
    embedContainerRef,
    `${post.id}:${shouldHydrate ? 'hydrated' : 'placeholder'}:${r.kind}`,
    {
      enabled: mediaLifecycleEnabled,
      hardSuspendDistanceVh: 6,
      disableHardSuspend: !(hasBeenPlayed && isVideoPost),
    }
  );


  // Track click-throughs to the original platform (iframe focus or anchor clicks).
  // Awards +1 engagement score to the author on top of the impression score.
  useOriginalVisitTracker(embedContainerRef, post.id, shouldHydrate, isPlayableMediaPost);

  // Restores July-31 scoring for cross-origin iframes (X, Threads, YouTube,
  // TikTok, Spotify, Pinterest, LinkedIn…) that expose no parent-side anchor.
  useEmbedEngagementFallback(embedContainerRef, post.id, shouldHydrate, isPlayableMediaPost);

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
    (platformHint === 'facebook' ||
      platformHint === 'threads' ||
      platformHint === 'linkedin' ||
      platformHint === 'instagram' ||
      lowerUrl.includes('facebook.com/') ||
      lowerUrl.includes('fb.watch/') ||
      lowerUrl.includes('fb.me/') ||
      lowerUrl.includes('threads.net/') ||
      lowerUrl.includes('threads.com/') ||
      lowerUrl.includes('linkedin.com/') ||
      lowerUrl.includes('instagram.com/') ||
      lowerUrl.includes('instagr.am/'));

  const isFacebookPost =
    platformHint === 'facebook' ||
    lowerUrl.includes('facebook.com/') ||
    lowerUrl.includes('fb.watch/') ||
    lowerUrl.includes('fb.me/');

  const isFacebookVideoLike =
    isFacebookPost &&
    (mediaTypeHint === 'video' ||
      String((post as any).media_kind || '').toLowerCase() === 'video' ||
      lowerUrl.includes('/reel/') ||
      lowerUrl.includes('/videos/') ||
      lowerUrl.includes('/watch/') ||
      lowerUrl.includes('/watch?') ||
      lowerUrl.includes('/watch.') ||
      lowerUrl.includes('/share/v/') ||
      lowerUrl.includes('/share/r/') ||
      lowerUrl.includes('fb.watch/'));

  useEffect(() => {
    if (!shouldHydrate) return;
    rememberHydratedPost(post.id);
  }, [post.id, shouldHydrate]);

  const handleRawEmbedError = useCallback(() => {
    setRawEmbedFailed(true);
    requestSourceValidation(post.id);
  }, [post.id]);

  const handleOriginalVisit = useCallback(() => {
    markOriginalVisit(post.id);
  }, [post.id]);

  const handleExternalOriginalClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    handleOriginalVisit();
    if (!mediaUrl) return;
    event.preventDefault();
    void openExternalUrl(mediaUrl);
  }, [handleOriginalVisit, mediaUrl]);
  
  const isYouTubePost = platformHint === 'youtube' || (!!r.url && /youtube\.com|youtu\.be/i.test(r.url));

  // For YouTube, prefer their thumbnail
  const effectiveThumbnail = isYouTubePost && r.url 
    ? getYouTubeThumbnail(r.url) || thumbnailUrl 
    : thumbnailUrl;
  
  const aspectClass = isYouTubePost && r.url && isYouTubeShort(
    r.url,
    post.title,
    (post as any).content,
    (post as any).aspect_ratio ?? (post as any).aspectRatio ?? null,
    (post as any).media_kind ?? (post as any).mediaKind ?? null,
  )
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

  // Facebook photo posts render more reliably as the fetched media itself.
  // The plugin iframe reserves a reactions/footer area that creates the blank
  // strip the user reported; videos still use the iframe/player path.
  if (shouldHydrate && isFacebookPost && effectiveThumbnail && !isFacebookVideoLike) {
    return (
      <div ref={embedContainerRef} className="w-full" data-embed-status="ready">
        <ImageViewTracker postId={post.id}>
          <a
            href={mediaUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExternalOriginalClick}
            className="block w-full overflow-hidden bg-muted"
          >
            <img
              src={effectiveThumbnail}
              alt="Facebook post content"
              className="w-full h-auto object-contain"
              loading="eager"
              decoding="async"
            />
          </a>
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
      <div className="w-full">

        {/* YouTube video */}
        {r.kind === 'video' && isYouTubePost && r.url && (
          <ImageViewTracker postId={post.id}>
            <div className={`w-full bg-black ${aspectClass}`}>
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=0&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </ImageViewTracker>
        )}
        
        {/* Non-YouTube video */}
        {r.kind === 'video' && !isYouTubePost && r.url && (
          <ImageViewTracker postId={post.id}>
            <video 
              src={r.url} 
              className="w-full h-auto" 
              controls 
              playsInline
            />
          </ImageViewTracker>
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
            <UniversalMetaEmbed url={mediaUrl} postId={post.id} suggestedHeight={(post as any).suggested_height ?? null} />
          </ImageViewTracker>
        )}
        
        {/* Raw embed HTML (Instagram, Facebook, Spotify) */}
        {r.kind === 'raw' && !forceTwitterRenderer && !forcePinterestRenderer && !forceUniversalRenderer && r.html && !rawEmbedFailed && (
          <ImageViewTracker postId={post.id}>
            <RawEmbedRenderer embedHtml={r.html} onError={handleRawEmbedError} onOriginalVisit={handleOriginalVisit} />
          </ImageViewTracker>
        )}

        {/* Fallback when raw embed fails — show UniversalMetaEmbed to rebuild */}
        {r.kind === 'raw' && !forceTwitterRenderer && !forcePinterestRenderer && !forceUniversalRenderer && rawEmbedFailed && post.mediaUrl && (
          <ImageViewTracker postId={post.id}>
            <UniversalMetaEmbed url={post.mediaUrl} postId={post.id} suggestedHeight={(post as any).suggested_height ?? null} />
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
            <RedditEmbed
              url={r.url}
              title={post.title}
              thumbnailUrl={effectiveThumbnail}
              description={(post as any).preview_text || (post as any).previewText || undefined}
              authorAvatar={(post as any).author?.avatar || (post as any).profiles?.avatar_url || null}
              postId={post.id}
              mediaKind={(post as any).media_kind ?? null}
              aspectRatio={(post as any).aspect_ratio ?? null}
              suggestedHeight={(post as any).suggested_height ?? null}
            />
          </ImageViewTracker>
        )}
        
        {/* Pinterest embed */}
        {r.kind === 'pinterest' && r.url && (
          <ImageViewTracker postId={post.id}>
            <PinterestEmbed
              url={r.url}
              postId={post.id}
              suggestedHeight={(post as any).suggested_height ?? null}
            />
          </ImageViewTracker>
        )}
        
        {/* Article embed */}
        {r.kind === 'article' && r.url && (
          <ImageViewTracker postId={post.id}>
            <ArticleEmbed url={r.url} postId={post.id} platform={post.platform} />
          </ImageViewTracker>
        )}
        
        {/* Universal Meta embed (Instagram, Facebook, etc) */}
        {r.kind === 'universal' && r.url && (
          <ImageViewTracker postId={post.id}>
            <UniversalMetaEmbed url={r.url} postId={post.id} suggestedHeight={(post as any).suggested_height ?? null} />
          </ImageViewTracker>
        )}
      </div>
    </div>
  );
});

HydratedEmbed.displayName = 'HydratedEmbed';
