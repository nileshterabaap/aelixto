import { useState, useEffect, useRef, useCallback } from 'react';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { OgCardFallback } from '@/components/OgCardFallback';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';

/**
 * Threads iframe with auto-fallback to OG card if iframe fails to load.
 */
const ThreadsIframeEmbed = ({
  src,
  expandedUrl,
  fallbackData,
}: {
  src: string;
  expandedUrl: string;
  fallbackData: { title?: string; image?: string; description?: string } | null;
}) => {
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Safety timeout: if iframe doesn't render content in 10s, show fallback
    const timeout = setTimeout(() => {
      if (iframeRef.current) {
        try {
          // If we can't access contentDocument (cross-origin), that's normal
          // Just check if the iframe is still showing (visible height > 0)
          const rect = iframeRef.current.getBoundingClientRect();
          if (rect.height < 50) {
            setFailed(true);
          }
        } catch {
          // Cross-origin — iframe loaded something, that's fine
        }
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  if (failed) {
    return (
      <OgCardFallback
        url={expandedUrl}
        title={fallbackData?.title}
        image={fallbackData?.image}
        description={fallbackData?.description}
        platform="Threads"
      />
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ width: '100%', display: 'block', height: '260px' }}>
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="no"
        allowFullScreen
        allow="encrypted-media"
        loading="lazy"
        onError={() => setFailed(true)}
        style={{
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100%',
          height: '450px',
          display: 'block',
          margin: 0,
          padding: 0,
          background: 'transparent',
        }}
      />
    </div>
  );
};

/**
 * Facebook iframe that auto-sizes to its content height.
 * Falls back to a generous min-height, then listens for the Facebook
 * plugins cross-origin resize message to snap to exact content height.
 */
const FacebookIframeEmbed = ({
  html,
  expandedUrl,
  fallbackData,
}: {
  html: string;
  expandedUrl: string;
  fallbackData: { title?: string; image?: string; description?: string } | null;
}) => {
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(520); // sensible default
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcMatch = html.match(/src="([^"]+)"/);
  const iframeSrc = srcMatch ? srcMatch[1] : '';

  // Listen for Facebook's cross-origin resize messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (typeof e.data === 'string') {
        try {
          const parsed = JSON.parse(e.data);
          // Facebook plugin sends {"type":"resize","height":XXX}
          if (parsed?.type === 'resize' && typeof parsed.height === 'number' && parsed.height > 50) {
            setHeight(parsed.height);
          }
        } catch {
          // not JSON, ignore
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Fallback: if iframe doesn't render in 12s, show OG card
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (iframeRef.current) {
        const rect = iframeRef.current.getBoundingClientRect();
        if (rect.height < 50) setFailed(true);
      }
    }, 12000);
    return () => clearTimeout(timeout);
  }, []);

  if (failed) {
    return (
      <OgCardFallback
        url={expandedUrl}
        title={fallbackData?.title}
        image={fallbackData?.image}
        description={fallbackData?.description}
        platform="Facebook"
      />
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ touchAction: 'pan-y' }}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        scrolling="no"
        allowFullScreen
        allow="encrypted-media"
        loading="lazy"
        onError={() => setFailed(true)}
        style={{
          border: 'none',
          width: '100%',
          height: `${height}px`,
          overflow: 'hidden',
          display: 'block',
        }}
      />
    </div>
  );
};

interface UniversalMetaEmbedProps {
  url: string;
}

// Cache resolved embeds to avoid re-processing when navigating between tabs/pages
// (keeps embeds feeling “instant” like Instagram).
type CachedEmbed = {
  embedHtml: string | null;
  fallbackData: { title?: string; image?: string; description?: string } | null;
  expandedUrl: string;
  embedUrl: string;
  showFallback: boolean;
};

const embedCache = new Map<string, CachedEmbed>();

// Detect platform from URL
const detectPlatform = (url: string): 'instagram' | 'facebook' | 'spotify' | 'reddit' | 'quora' | 'medium' | 'blog' | 'threads' | 'linkedin' | 'tiktok' | 'unknown' => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
    return 'instagram';
  }
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
    return 'facebook';
  }
  if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) {
    return 'spotify';
  }
  if (urlLower.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (urlLower.includes('reddit.com')) {
    return 'reddit';
  }
  if (urlLower.includes('quora.com')) {
    return 'quora';
  }
  if (urlLower.includes('medium.com')) {
    return 'medium';
  }
  if (urlLower.includes('threads.net') || urlLower.includes('threads.com')) {
    return 'threads';
  }
  if (urlLower.includes('linkedin.com')) {
    return 'linkedin';
  }
  if (
    urlLower.includes('blog') ||
    urlLower.includes('.wordpress.com') ||
    urlLower.includes('blogger.com') ||
    urlLower.includes('ghost.io') ||
    urlLower.includes('substack.com')
  ) {
    return 'blog';
  }
  return 'unknown';
};

// Build Instagram embed HTML using direct iframe (bypasses unreliable SDK)
const buildInstagramEmbed = (url: string): string => {
  // Extract the post/reel path and build a direct embed iframe URL
  // Instagram supports /embed/ suffix on post/reel URLs
  try {
    const u = new URL(url);
    // Clean the path - remove trailing slash, add /embed/
    let embedPath = u.pathname.replace(/\/$/, '') + '/embed/';
    const embedUrl = `https://www.instagram.com${embedPath}`;
    return `<iframe src="${embedUrl}" style="border:0;width:100%;overflow:hidden;" scrolling="no" allowfullscreen allow="encrypted-media; autoplay" loading="lazy"></iframe>`;
  } catch {
    // Fallback: just append /embed/ to the URL
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    return `<iframe src="${cleanUrl}/embed/" style="border:0;width:100%;overflow:hidden;" scrolling="no" allowfullscreen allow="encrypted-media; autoplay" loading="lazy"></iframe>`;
  }
};

// Normalize Facebook URLs for reliable embedding
const normalizeFacebookUrl = (raw: string): string => {
  let url = raw.trim();

  // 1) Always use www. instead of mobile variants
  url = url
    .replace(/^https?:\/\/m\.facebook\.com\//, 'https://www.facebook.com/')
    .replace(/^https?:\/\/lm\.facebook\.com\//, 'https://www.facebook.com/')
    .replace(/^https?:\/\/l\.facebook\.com\//, 'https://www.facebook.com/');

  // 2) If it's a login redirect, extract the actual post URL from "next" parameter
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('facebook.com') && u.pathname.includes('/login') && u.searchParams.get('next')) {
      const actualUrl = decodeURIComponent(u.searchParams.get('next')!);
      url = actualUrl;
    }
  } catch (e) {
    console.warn('[FB EMBED] Failed to parse login redirect:', e);
  }

  // 3) If it's an l.facebook.com redirect, extract the "u" param
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('facebook.com') && u.pathname === '/l.php' && u.searchParams.get('u')) {
      const extractedUrl = decodeURIComponent(u.searchParams.get('u')!);
      url = extractedUrl;
    }
  } catch (e) {
    console.warn('[FB EMBED] Failed to parse redirect URL:', e);
  }

  // 4) Strip tracking / share junk that shouldn't affect the canonical post
  const stripParams = ['mibextid', 'ref', 'refid', 'sfnsn', 'app', 'paipv', 'rdid', 'share_url'];

  try {
    const u2 = new URL(url);
    stripParams.forEach((p) => u2.searchParams.delete(p));
    // Also drop hash fragments that aren't part of the post identity
    u2.hash = '';
    url = u2.toString();
  } catch (e) {
    console.warn('[FB EMBED] Failed to clean URL params:', e);
  }

  return url;
  return url;
};

// Build Facebook embed using direct iframe (bypasses slow SDK)
const buildFacebookEmbed = (url: string): string | null => {
  const canonical = normalizeFacebookUrl(url);
  // Share URLs (e.g. /share/v/..., /share/r/...) redirect and won't render in
  // facebook plugins directly. Skip immediate render — let URL expansion resolve them first.
  if (canonical.includes('/share/')) return null;

  const isVideo =
    canonical.includes('/reel/') ||
    canonical.includes('/videos/') ||
    canonical.includes('/watch/') ||
    canonical.includes('fb.watch');

  const pluginEndpoint = isVideo ? 'video.php' : 'post.php';
  const encodedUrl = encodeURIComponent(canonical);
  const query = isVideo
    ? `href=${encodedUrl}&width=500`
    : `href=${encodedUrl}&show_text=true&width=500`;

  return `<iframe src="https://www.facebook.com/plugins/${pluginEndpoint}?${query}" style="border:none;width:100%;aspect-ratio:4/5;overflow:hidden;" scrolling="no" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
};

// Check if Spotify URL is embeddable (not wrapped-share or other special pages)
const isEmbeddableSpotifyUrl = (url: string): boolean => {
  // Wrapped share URLs and other special pages can't be embedded
  if (url.includes('/wrapped-share/') || url.includes('/wrapped/')) {
    return false;
  }
  // Standard embeddable content types
  return (
    url.includes('/track/') ||
    url.includes('/album/') ||
    url.includes('/playlist/') ||
    url.includes('/artist/') ||
    url.includes('/episode/') ||
    url.includes('/show/')
  );
};

// Build Spotify embed HTML
const buildSpotifyEmbed = (url: string): string | null => {
  if (!isEmbeddableSpotifyUrl(url)) return null;
  let embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
  if (url.includes('/embed/')) embedUrl = url;
  return `<iframe style="border-radius:12px;display:block;" src="${embedUrl}" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
};

// Build LinkedIn embed HTML using their native embed endpoint
const buildLinkedInEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);

    // Pattern 1: /feed/update/urn:li:activity:ID or urn:li:share:ID or urn:li:ugcPost:ID
    const feedMatch = u.pathname.match(/\/feed\/update\/(urn:li:\w+:\d+)/);
    if (feedMatch) {
      const urn = feedMatch[1];
      return `<iframe src="https://www.linkedin.com/embed/feed/update/${urn}?collapsed=1" width="100%" frameborder="0" allowfullscreen="" style="border:none;overflow:hidden;display:block;aspect-ratio:4/5;" loading="lazy"></iframe>`;
    }

    // Pattern 2: /posts/username_slug-ugcPost-ID-hash or -activity-ID-hash
    // Note: separator before type can be underscore or hyphen
    const postMatch = u.pathname.match(/\/posts\/[^/]+[_-](?:ugcPost|activity)-(\d+)-/);
    if (postMatch) {
      const id = postMatch[1];
      const typeMatch = u.pathname.match(/[_-](ugcPost|activity)-/);
      const type = typeMatch ? typeMatch[1] : 'ugcPost';
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:${type}:${id}?collapsed=1" width="100%" frameborder="0" allowfullscreen="" style="border:none;overflow:hidden;display:block;aspect-ratio:4/5;" loading="lazy"></iframe>`;
    }

    // Pattern 3: /posts/username_slug-share-ID-hash
    const shareMatch = u.pathname.match(/\/posts\/[^/]+[_-]share-(\d+)-/);
    if (shareMatch) {
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:${shareMatch[1]}?collapsed=1" width="100%" frameborder="0" allowfullscreen="" style="border:none;overflow:hidden;display:block;aspect-ratio:4/5;" loading="lazy"></iframe>`;
    }
  } catch {
    // Fall through to null
  }
  return null;
};

// Build Threads embed HTML using direct iframe (reliable in SPAs, no SDK needed)
const buildThreadsEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);
    const postMatch = u.pathname.match(/\/@([^/]+)\/post\/([A-Za-z0-9_-]+)/);
    if (postMatch) {
      const cleanPath = u.pathname.replace(/\/$/, '');
      const embedUrl = `https://www.threads.net${cleanPath}/embed`.replace('threads.com', 'threads.net');
      return `<iframe src="${embedUrl}" style="border:none;position:absolute;top:0;left:0;right:0;width:100%;max-width:100%;height:450px;display:block;margin:0;padding:0;background:transparent;" scrolling="no" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
    }
  } catch {
    // Fall through
  }
  return null;
};

// Build TikTok embed HTML using oEmbed blockquote approach
const buildTikTokEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);
    // TikTok video URLs: /@user/video/ID or /t/ID
    const videoMatch = u.pathname.match(/\/@[^/]+\/video\/(\d+)/) || u.pathname.match(/\/t\/([A-Za-z0-9]+)/);
    if (videoMatch) {
      return `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${videoMatch[1]}" style="max-width:605px;min-width:325px;"><section><a target="_blank" href="${url}" rel="noopener noreferrer">View on TikTok</a></section></blockquote><script async src="https://www.tiktok.com/embed.js"></script>`;
    }
  } catch {
    // Fall through
  }
  return null;
};


export const UniversalMetaEmbed = ({ url }: UniversalMetaEmbedProps) => {
  const cached = embedCache.get(url);

  const [embedHtml, setEmbedHtml] = useState<string | null>(cached?.embedHtml ?? null);
  const [fallbackData, setFallbackData] = useState<{ title?: string; image?: string; description?: string } | null>(
    cached?.fallbackData ?? null
  );
  const [expandedUrl, setExpandedUrl] = useState(cached?.expandedUrl ?? url);
  const [embedUrl, setEmbedUrl] = useState(cached?.embedUrl ?? url); // Separate URL for embedding
  const [showFallback, setShowFallback] = useState(cached?.showFallback ?? false);
  const lastTapRef = useRef<number>(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      window.open(embedUrl, '_blank', 'noopener,noreferrer');
    }

    lastTapRef.current = now;
  };

  useEffect(() => {
    // Instant first paint: build an embed immediately (no "Loading embed" flash).
    // Then enhance in background (expand URLs + fetch OG + cache result).
    const platform = detectPlatform(url);
    const immediateHtml =
      platform === 'instagram'
        ? buildInstagramEmbed(url)
        : platform === 'facebook'
          ? buildFacebookEmbed(url)
          : platform === 'spotify'
            ? buildSpotifyEmbed(url)
            : platform === 'linkedin'
              ? buildLinkedInEmbed(url)
              : platform === 'threads'
                ? buildThreadsEmbed(url)
                : platform === 'tiktok'
                  ? buildTikTokEmbed(url)
                  : null;

    if (immediateHtml && !showFallback) {
      setEmbedHtml(immediateHtml);
    }

    const processUrl = async () => {
      let finalUrl = url;
      let urlForEmbed = url;
      let shouldShowFallback = false;
      let computedHtml: string | null = null;

      try {
        // Step 1: Expand short URLs and Facebook share URLs
        const needsExpansion =
          url.includes('fb.watch') ||
          url.includes('fb.me') ||
          url.includes('bit.ly') ||
          url.includes('pin.it') ||
          (url.includes('facebook.com') && url.includes('/share/'));

        if (needsExpansion) {
          
          try {
            const { data: expandData, error: expandError } = await supabase.functions.invoke('expand-url', {
              body: { url },
            });

            if (!expandError && expandData?.finalUrl) {
              finalUrl = expandData.finalUrl;
              urlForEmbed = finalUrl;
              

              // If expanded URL is a login redirect or has login in title, use fallback
              if (finalUrl.includes('/login/') && platform === 'facebook') {
                
                shouldShowFallback = true;
              }

              if (expandData?.title?.toLowerCase().includes('log in to facebook')) {
                
                shouldShowFallback = true;
              }
            } else {
              console.warn('[UniversalMetaEmbed] Expansion failed, using original URL:', expandError);
              urlForEmbed = url;
            }
          } catch (err) {
            console.error('[UniversalMetaEmbed] Expansion error:', err);
            urlForEmbed = url;
          }
        }

        setExpandedUrl(finalUrl);
        setEmbedUrl(urlForEmbed);

        // Step 2: Fetch OG data for fallback (non-blocking)
        supabase.functions
          .invoke('fetch-og', {
            body: { url: finalUrl },
          })
          .then(({ data: ogData, error: ogError }) => {
            if (!ogError && ogData) {
              const ogTitle = ogData.meta?.title || ogData.title;

              // Check if the OG data indicates a login page
              if (ogTitle?.toLowerCase().includes('log in to facebook') && platform === 'facebook') {
                
                shouldShowFallback = true;
                setShowFallback(true);
              }

              setFallbackData({
                title: ogTitle,
                image: ogData.meta?.image || ogData.image,
                description: ogData.meta?.description || ogData.description,
              });
            }
          })
          .catch((err) => console.warn('[UniversalMetaEmbed] OG fetch failed:', err));

        // Step 3: Build embed HTML based on platform (skip if we should show fallback)
        computedHtml = null;
        if (!shouldShowFallback) {
          if (platform === 'instagram') {
            computedHtml = buildInstagramEmbed(urlForEmbed);
          } else if (platform === 'facebook') {
            computedHtml = buildFacebookEmbed(urlForEmbed);
          } else if (platform === 'spotify') {
            computedHtml = buildSpotifyEmbed(urlForEmbed);
          } else if (platform === 'linkedin') {
            computedHtml = buildLinkedInEmbed(urlForEmbed);
          } else if (platform === 'threads') {
            computedHtml = buildThreadsEmbed(urlForEmbed);
          } else if (platform === 'tiktok') {
            computedHtml = buildTikTokEmbed(urlForEmbed);
          }

          if (computedHtml) {
            setEmbedHtml(computedHtml);
          } else {
            shouldShowFallback = true;
            setShowFallback(true);
          }
        } else {
          setShowFallback(true);
        }
      } catch (error) {
        console.error('[UniversalMetaEmbed] Error processing URL:', error);
      }

      // Write computed values to cache (NOT stale state refs)
      const cacheEntry: CachedEmbed = {
        embedHtml: shouldShowFallback ? null : computedHtml ?? immediateHtml,
        fallbackData: null, // OG data arrives async and updates cache separately
        expandedUrl: finalUrl,
        embedUrl: urlForEmbed,
        showFallback: shouldShowFallback,
      };
      embedCache.set(url, cacheEntry);
    };

    // If we already have a cached resolved version, don't redo network work.
    if (!cached) {
      processUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (embedHtml && !showFallback) {
    // For direct iframe embeds (Spotify, Instagram, LinkedIn, Threads), render without RawEmbedRenderer
    const isDirectIframe = embedHtml.includes('open.spotify.com/embed') || (embedHtml.includes('instagram.com') && embedHtml.includes('<iframe')) || embedHtml.includes('linkedin.com/embed') || (embedHtml.includes('threads.net') && embedHtml.includes('<iframe')) || (embedHtml.includes('facebook.com/plugins/') && embedHtml.includes('<iframe'));

    if (isDirectIframe) {
      const sanitizedHtml = DOMPurify.sanitize(embedHtml, {
        ALLOWED_TAGS: ['iframe'],
        ALLOWED_ATTR: ['src', 'style', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'loading', 'scrolling']
      });
      const isInstagramIframe = embedHtml.includes('instagram.com');
      const isThreadsIframe = embedHtml.includes('threads.net');
      const isFacebookIframe = embedHtml.includes('facebook.com/plugins/');

      if (isFacebookIframe) {
        return (
          <FacebookIframeEmbed
            html={sanitizedHtml}
            expandedUrl={expandedUrl}
            fallbackData={fallbackData}
          />
        );
      }

      if (isInstagramIframe) {
        // Extract the src URL from the sanitized iframe HTML
        const srcMatch = sanitizedHtml.match(/src="([^"]+)"/);
        const iframeSrc = srcMatch ? srcMatch[1] : '';

        return (
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: '3 / 5', touchAction: 'pan-y' }}
          >
            <iframe
              src={iframeSrc}
              scrolling="no"
              allowFullScreen
              allow="encrypted-media; autoplay"
              loading="lazy"
              style={{
                border: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: 'calc(100% + 500px)',
                overflow: 'hidden',
              }}
            />
          </div>
        );
      }

      // Threads iframe: render with onError fallback
      if (isThreadsIframe) {
        const srcMatch = sanitizedHtml.match(/src="([^"]+)"/);
        const iframeSrc = srcMatch ? srcMatch[1] : '';

        return (
          <ThreadsIframeEmbed
            src={iframeSrc}
            expandedUrl={expandedUrl}
            fallbackData={fallbackData}
          />
        );
      }

      return (
        <div
          className="relative w-full overflow-hidden [&>iframe]:w-full [&>iframe]:block"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      );
    }

    return (
      <div onClick={handleDoubleTap}>
        <RawEmbedRenderer
          embedHtml={embedHtml}
          onError={() => {
            
            setShowFallback(true);
          }}
        />
      </div>
    );
  }

  // Show fallback if no embed HTML or if embed failed
  const platform = detectPlatform(expandedUrl);
  const platformName =
    platform === 'instagram' ? 'Instagram'
    : platform === 'facebook' ? 'Facebook'
    : platform === 'spotify' ? 'Spotify'
    : platform === 'reddit' ? 'Reddit'
    : platform === 'quora' ? 'Quora'
    : platform === 'medium' ? 'Medium'
    : platform === 'blog' ? 'Blog'
    : platform === 'threads' ? 'Threads'
    : platform === 'linkedin' ? 'LinkedIn'
    : platform === 'tiktok' ? 'TikTok'
    : 'Web';

  return (
    <OgCardFallback
      url={expandedUrl}
      title={fallbackData?.title}
      image={fallbackData?.image}
      description={fallbackData?.description}
      platform={platformName}
    />
  );
};
