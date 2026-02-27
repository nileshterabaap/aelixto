import { memo } from 'react';
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

/**
 * Interactive embed renderer — only mounted AFTER user taps to activate.
 * No thumbnail placeholders here; those are handled by StaticPreview.
 * This component only renders live embeds (iframes, scripts, rich media).
 */
export const HydratedEmbed = memo(({ 
  post, 
  renderer: r, 
}: HydratedEmbedProps) => {
  const aspectClass = post.platform === 'youtube' && r.url && isYouTubeShort(r.url)
    ? 'aspect-[9/16]'
    : 'aspect-video';

  if (r.kind === 'none') return null;

  return (
    <div className="w-full" style={{ contain: 'layout paint' }}>
      {/* YouTube video */}
      {r.kind === 'video' && post.platform === 'youtube' && r.url && (
        <SkeletonGate platform="youtube">
          <div className={`w-full bg-black ${aspectClass}`}>
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${getYouTubeVideoId(r.url)}?autoplay=1&playsinline=1&rel=0`}
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
