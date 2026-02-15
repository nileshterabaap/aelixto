import { useState, useEffect, useRef } from 'react';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { OgCardFallback } from '@/components/OgCardFallback';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';

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
const detectPlatform = (url: string): 'instagram' | 'facebook' | 'spotify' | 'reddit' | 'quora' | 'medium' | 'blog' | 'threads' | 'linkedin' | 'unknown' => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
    return 'instagram';
  }
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
    console.log('[UniversalMetaEmbed] Detected Facebook URL:', url);
    return 'facebook';
  }
  if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) {
    return 'spotify';
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
    return `<iframe src="${embedUrl}" style="border:0;width:100%;min-height:500px;overflow:hidden;" scrolling="no" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
  } catch {
    // Fallback: just append /embed/ to the URL
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    return `<iframe src="${cleanUrl}/embed/" style="border:0;width:100%;min-height:500px;overflow:hidden;" scrolling="no" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
  }
};

// Normalize Facebook URLs for reliable embedding
const normalizeFacebookUrl = (raw: string): string => {
  let url = raw.trim();

  console.log('[FB EMBED] Starting normalization for:', url);

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
      console.log('[FB EMBED] Extracted URL from login redirect:', actualUrl);
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
      console.log('[FB EMBED] Extracted redirect URL:', extractedUrl);
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

  console.log('[FB EMBED] Normalized URL:', url);
  return url;
};

// Build Facebook embed using SDK approach (XFBML)
const buildFacebookEmbed = (url: string): string => {
  const canonical = normalizeFacebookUrl(url);

  console.log('[FB EMBED] Building embed:', {
    originalUrl: url,
    normalizedUrl: canonical,
    embedType: 'sdk-xfbml-div',
  });

  // IMPORTANT: do not hardcode data-width (breaks mobile sizing). Let CSS control width.
  return `<div class="fb-post" data-href="${canonical}" data-show-text="true"></div>`;
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
      return `<iframe src="https://www.linkedin.com/embed/feed/update/${urn}?collapsed=1" height="600" width="100%" frameborder="0" allowfullscreen="" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }

    // Pattern 2: /posts/username_slug-ugcPost-ID-hash or -activity-ID-hash
    // Note: separator before type can be underscore or hyphen
    const postMatch = u.pathname.match(/\/posts\/[^/]+[_-](?:ugcPost|activity)-(\d+)-/);
    if (postMatch) {
      const id = postMatch[1];
      const typeMatch = u.pathname.match(/[_-](ugcPost|activity)-/);
      const type = typeMatch ? typeMatch[1] : 'ugcPost';
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:${type}:${id}?collapsed=1" height="600" width="100%" frameborder="0" allowfullscreen="" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }

    // Pattern 3: /posts/username_slug-share-ID-hash
    const shareMatch = u.pathname.match(/\/posts\/[^/]+[_-]share-(\d+)-/);
    if (shareMatch) {
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:${shareMatch[1]}?collapsed=1" height="600" width="100%" frameborder="0" allowfullscreen="" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }
  } catch {
    // Fall through to null
  }
  return null;
};

// Build Threads embed HTML using direct iframe (like Instagram)
const buildThreadsEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);
    const postMatch = u.pathname.match(/\/@[^/]+\/post\/([A-Za-z0-9_-]+)/);
    if (postMatch) {
      // Standardize to threads.net and append /embed
      const cleanPath = u.pathname.replace(/\/$/, '');
      const embedUrl = `https://www.threads.net${cleanPath}/embed`.replace('threads.com', 'threads.net');
      return `<iframe src="${embedUrl}" style="border:none;width:100%;min-height:500px;overflow:hidden;display:block;" scrolling="no" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
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
                : null;

    if (immediateHtml && !showFallback) {
      setEmbedHtml(immediateHtml);
    }

    const processUrl = async () => {
      let finalUrl = url;
      let urlForEmbed = url;
      let shouldShowFallback = false;

      try {
        // Step 1: Expand short URLs and Facebook share URLs
        const needsExpansion =
          url.includes('fb.watch') ||
          url.includes('fb.me') ||
          url.includes('bit.ly') ||
          url.includes('pin.it') ||
          (url.includes('facebook.com') && url.includes('/share/'));

        if (needsExpansion) {
          console.log('[UniversalMetaEmbed] Expanding URL:', url);
          try {
            const { data: expandData, error: expandError } = await supabase.functions.invoke('expand-url', {
              body: { url },
            });

            if (!expandError && expandData?.finalUrl) {
              finalUrl = expandData.finalUrl;
              urlForEmbed = finalUrl;
              console.log('[UniversalMetaEmbed] Expanded to:', finalUrl);

              // If expanded URL is a login redirect or has login in title, use fallback
              if (finalUrl.includes('/login/') && platform === 'facebook') {
                console.log('[UniversalMetaEmbed] Expanded URL is login redirect, will use fallback');
                shouldShowFallback = true;
              }

              if (expandData?.title?.toLowerCase().includes('log in to facebook')) {
                console.log('[UniversalMetaEmbed] Title indicates login required, will use fallback');
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
                console.log('[UniversalMetaEmbed] OG title indicates login page, showing fallback');
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
        if (!shouldShowFallback) {
          if (platform === 'instagram') {
            setEmbedHtml(buildInstagramEmbed(urlForEmbed));
          } else if (platform === 'facebook') {
            setEmbedHtml(buildFacebookEmbed(urlForEmbed));
          } else if (platform === 'spotify') {
            const html = buildSpotifyEmbed(urlForEmbed);
            if (html) {
              setEmbedHtml(html);
            } else {
              shouldShowFallback = true;
              setShowFallback(true);
            }
          } else if (platform === 'linkedin') {
            const html = buildLinkedInEmbed(urlForEmbed);
            if (html) {
              setEmbedHtml(html);
            } else {
              shouldShowFallback = true;
              setShowFallback(true);
            }
          } else if (platform === 'threads') {
            const html = buildThreadsEmbed(urlForEmbed);
            if (html) {
              setEmbedHtml(html);
            } else {
              shouldShowFallback = true;
              setShowFallback(true);
            }
          }
        } else {
          setShowFallback(true);
        }
      } catch (error) {
        console.error('[UniversalMetaEmbed] Error processing URL:', error);
      } finally {
        // Write the most recent state to cache (prevents flicker on navigation back)
        const next: CachedEmbed = {
          embedHtml: shouldShowFallback ? null : embedHtml,
          fallbackData,
          expandedUrl: finalUrl,
          embedUrl: urlForEmbed,
          showFallback: shouldShowFallback || showFallback,
        };
        embedCache.set(url, next);
      }
    };

    // If we already have a cached resolved version, don't redo network work.
    if (!cached) {
      processUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (embedHtml && !showFallback) {
    // For direct iframe embeds (Spotify, Instagram, LinkedIn, Threads), render without RawEmbedRenderer
    const isDirectIframe = embedHtml.includes('open.spotify.com/embed') || (embedHtml.includes('instagram.com') && embedHtml.includes('<iframe')) || embedHtml.includes('linkedin.com/embed') || (embedHtml.includes('threads.net') && embedHtml.includes('<iframe'));

    if (isDirectIframe) {
      const sanitizedHtml = DOMPurify.sanitize(embedHtml, {
        ALLOWED_TAGS: ['iframe'],
        ALLOWED_ATTR: ['src', 'style', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'loading', 'scrolling']
      });
      const srcMatch = sanitizedHtml.match(/src="([^"]+)"/);
      const iframeSrc = srcMatch ? srcMatch[1] : '';
      const isInstagramIframe = embedHtml.includes('instagram.com');
      const isThreadsIframe = embedHtml.includes('threads.net');
      const isLinkedInIframe = embedHtml.includes('linkedin.com/embed');

      if (isInstagramIframe) {
        return (
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: '3 / 4', touchAction: 'pan-y' }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
                touchAction: 'pan-y',
              }}
            />
            <iframe
              src={iframeSrc}
              scrolling="no"
              allowFullScreen
              allow="encrypted-media"
              loading="lazy"
              style={{
                border: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: 'calc(100% + 400px)',
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      }

      if (isThreadsIframe) {
        // Clip the Threads "Trending" top bar (~56px) and the
        // native action-buttons / footer at the bottom.
        // Container auto-sizes via the iframe's intrinsic height
        // minus what we clip from top & bottom.
        // top clip = 56px, bottom clip ≈ 100px → container = iframe - 156
        const iframeH = 490;
        const topClip = 56;
        const bottomClip = 264;
        const containerH = iframeH - topClip - bottomClip; // 444px

        return (
          <div
            className="relative w-full overflow-hidden"
            style={{ height: `${containerH}px`, touchAction: 'pan-y' }}
          >
            <iframe
              src={iframeSrc}
              scrolling="no"
              allowFullScreen
              allow="encrypted-media"
              loading="lazy"
              style={{
                border: 'none',
                position: 'absolute',
                top: `-${topClip}px`,
                left: 0,
                width: '100%',
                height: `${iframeH}px`,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      }

      if (isLinkedInIframe) {
        // LinkedIn's native embed handles "...more" for long text;
        // just give it enough height and let the iframe scroll internally
        return (
          <div className="relative w-full overflow-hidden">
            <iframe
              src={iframeSrc}
              allowFullScreen
              loading="lazy"
              style={{
                border: 'none',
                width: '100%',
                height: '600px',
                display: 'block',
                overflow: 'hidden',
              }}
            />
          </div>
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
            console.log('[UniversalMetaEmbed] onError called, setting showFallback to true');
            setShowFallback(true);
          }}
        />
      </div>
    );
  }

  // Show fallback if no embed HTML or if embed failed
  const platform = detectPlatform(expandedUrl);
  const platformName =
    platform === 'instagram'
      ? 'Instagram'
      : platform === 'facebook'
        ? 'Facebook'
        : platform === 'spotify'
          ? 'Spotify'
          : platform === 'reddit'
            ? 'Reddit'
            : platform === 'quora'
              ? 'Quora'
              : platform === 'medium'
                ? 'Medium'
                : platform === 'blog'
                  ? 'Blog'
                  : platform === 'threads'
                    ? 'Threads'
                    : platform === 'linkedin'
                      ? 'LinkedIn'
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

