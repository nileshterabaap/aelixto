import { useRef, useState } from 'react';
import { EMBED_FADE_MS, EmbedFadeSkeleton, useSmoothReveal } from '@/components/embeds/SmoothEmbedFrame';

/**
 * LinkedIn iframe restored to a fixed, internally scrollable viewport.
 * LinkedIn cards can be taller than the Aelixto post card, so the iframe
 * itself must scroll instead of expanding the outer feed item.
 *
 * This component is intentionally extracted into its own file so the
 * per-platform stability guard can freeze LinkedIn independently of the
 * shared UniversalMetaEmbed module.
 */
const LI_VIEWPORT_HEIGHT = 760;

export const LinkedInIframeEmbed = ({
  src,
}: {
  src: string;
  postId?: string | null;
  suggestedHeight?: number | null;
  expandedUrl?: string;
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const revealed = useSmoothReveal(hasLoaded);

  return (
    <div
      className="relative w-full overflow-hidden bg-background"
      style={{ width: '100%', height: `${LI_VIEWPORT_HEIGHT}px`, minHeight: `${LI_VIEWPORT_HEIGHT}px`, touchAction: 'pan-y' }}
    >
      <EmbedFadeSkeleton visible={!revealed} />
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="auto"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        onLoad={() => setHasLoaded(true)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          minHeight: `${LI_VIEWPORT_HEIGHT}px`,
          display: 'block',
          background: 'hsl(var(--background))',
          position: 'relative',
          zIndex: 1,
          opacity: revealed ? 1 : 0,
          transition: `opacity ${EMBED_FADE_MS}ms ease`,
        }}
      />
    </div>
  );
};

// Build LinkedIn embed HTML using their native embed endpoint
export const buildLinkedInEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);

    // Pattern 1: /feed/update/urn:li:activity:ID or urn:li:share:ID or urn:li:ugcPost:ID
    const feedMatch = u.pathname.match(/\/feed\/update\/(urn:li:\w+:\d+)/);
    if (feedMatch) {
      const urn = feedMatch[1];
      return `<iframe src="https://www.linkedin.com/embed/feed/update/${urn}" width="100%" frameborder="0" allowfullscreen="" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }

    // Pattern 2: /posts/username_slug-ugcPost-ID-hash or -activity-ID-hash
    const postMatch = u.pathname.match(/\/posts\/[^/]+[_-](?:ugcPost|activity)-(\d+)-/);
    if (postMatch) {
      const id = postMatch[1];
      const typeMatch = u.pathname.match(/[_-](ugcPost|activity)-/);
      const type = typeMatch ? typeMatch[1] : 'ugcPost';
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:${type}:${id}" width="100%" frameborder="0" allowfullscreen="" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }

    // Pattern 3: /posts/username_slug-share-ID-hash
    const shareMatch = u.pathname.match(/\/posts\/[^/]+[_-]share-(\d+)-/);
    if (shareMatch) {
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:${shareMatch[1]}" width="100%" frameborder="0" allowfullscreen="" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }
  } catch {
    // Fall through to null
  }
  return null;
};