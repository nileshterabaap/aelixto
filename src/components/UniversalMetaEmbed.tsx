import { useState, useEffect } from 'react';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { OgCardFallback } from '@/components/OgCardFallback';
import { supabase } from '@/integrations/supabase/client';

interface UniversalMetaEmbedProps {
  url: string;
}

// Detect platform from URL
const detectPlatform = (url: string): 'instagram' | 'facebook' | 'spotify' | 'reddit' | 'quora' | 'medium' | 'blog' | 'unknown' => {
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
  if (urlLower.includes('blog') || urlLower.includes('.wordpress.com') || urlLower.includes('blogger.com') || 
      urlLower.includes('ghost.io') || urlLower.includes('substack.com')) {
    return 'blog';
  }
  return 'unknown';
};

// Build Instagram embed HTML
const buildInstagramEmbed = (url: string): string => {
  return `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote>`;
};

// Build Facebook embed HTML (post or video)
const buildFacebookEmbed = (url: string): string => {
  // Clean and normalize Facebook URLs for embedding
  let cleanUrl = url;
  try {
    const urlObj = new URL(url);
    
    // For reels and videos, keep only the base path without query params
    if (url.includes('/reel/') || url.includes('/videos/') || url.includes('/watch/')) {
      cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
      console.log('[UniversalMetaEmbed] Cleaned video/reel URL from', url, 'to', cleanUrl);
    }
  } catch (e) {
    console.error('[UniversalMetaEmbed] Failed to parse URL:', e);
  }
  
  // Detect if it's a video or reel based on URL pattern
  const isVideo = cleanUrl.includes('/videos/') || cleanUrl.includes('/watch/') || cleanUrl.includes('/reel/');
  console.log('[UniversalMetaEmbed] Building Facebook embed - isVideo:', isVideo, 'URL:', cleanUrl);
  
  if (isVideo) {
    return `<div class="fb-video" data-href="${cleanUrl}" data-width="auto" data-show-text="true"></div>`;
  }
  return `<div class="fb-post" data-href="${cleanUrl}" data-width="auto" data-show-text="true"></div>`;
};

// Build Spotify embed HTML
const buildSpotifyEmbed = (url: string): string => {
  // Convert regular Spotify URL to embed URL
  // e.g., https://open.spotify.com/track/xyz -> https://open.spotify.com/embed/track/xyz
  let embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
  
  // If it already has /embed/, don't add it again
  if (url.includes('/embed/')) {
    embedUrl = url;
  }
  
  return `<iframe style="border-radius:12px;display:block;" src="${embedUrl}" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
};

// Clean Facebook embed HTML to remove stats footer
const cleanFacebookHtml = (html: string): string => {
  // Remove views/reactions lines (e.g., "7.2K views · 589 reactions | ...")
  html = html.replace(/[\d,.]+K?\s*views\s*[·|]\s*[\d,.]+K?\s*reactions?\s*\|/gi, "");

  // Decode HTML entities like &#xb7; etc.
  html = html.replace(/&#[xX]?[0-9A-Fa-f]+;/g, match => {
    try {
      const el = document.createElement("textarea");
      el.innerHTML = match;
      return el.value;
    } catch {
      return "";
    }
  });

  // Trim extra whitespace left behind
  return html.replace(/\s{2,}/g, " ").trim();
};

export const UniversalMetaEmbed = ({ url }: UniversalMetaEmbedProps) => {
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [fallbackData, setFallbackData] = useState<{ title?: string; image?: string; description?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUrl, setExpandedUrl] = useState(url);

  useEffect(() => {
    const processUrl = async () => {
      setIsLoading(true);
      
      try {
        // Step 1: Expand short URLs and Facebook share URLs
        const platform = detectPlatform(url);
        let finalUrl = url;

        // Expand if it's a short link OR a Facebook share URL
        const needsExpansion = url.includes('fb.watch') || url.includes('fb.me') || 
                               url.includes('bit.ly') || url.includes('pin.it') ||
                               url.includes('/share/r/') || url.includes('/share/v/');
        
        if (needsExpansion) {
          console.log('[UniversalMetaEmbed] Expanding URL:', url);
          const { data: expandData, error: expandError } = await supabase.functions.invoke('expand-url', {
            body: { url }
          });

          if (!expandError && expandData?.finalUrl) {
            finalUrl = expandData.finalUrl;
            console.log('[UniversalMetaEmbed] Expanded to:', finalUrl);
          }
        }

        setExpandedUrl(finalUrl);

      // Step 2: Build embed HTML based on platform
      if (platform === 'instagram') {
        const html = buildInstagramEmbed(finalUrl);
        setEmbedHtml(html);
        console.log('[UniversalMetaEmbed] Built Instagram embed');
      } else if (platform === 'facebook') {
        const html = buildFacebookEmbed(finalUrl);
        setEmbedHtml(html);
        console.log('[UniversalMetaEmbed] Built Facebook embed:', html);
      } else if (platform === 'spotify') {
        const html = buildSpotifyEmbed(finalUrl);
        setEmbedHtml(html);
        console.log('[UniversalMetaEmbed] Built Spotify embed');
      }

        // Step 3: Fetch OG data for fallback
        console.log('[UniversalMetaEmbed] Fetching OG data for fallback');
        const { data: ogData, error: ogError } = await supabase.functions.invoke('fetch-og', {
          body: { url: finalUrl }
        });

        if (!ogError && ogData) {
          setFallbackData({
            title: ogData.meta?.title || ogData.title,
            image: ogData.meta?.image || ogData.image,
            description: ogData.meta?.description || ogData.description
          });
          console.log('[UniversalMetaEmbed] OG data fetched:', ogData);
        }

      } catch (error) {
        console.error('[UniversalMetaEmbed] Error processing URL:', error);
      } finally {
        setIsLoading(false);
      }
    };

    processUrl();
  }, [url]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border-2 border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading embed...</p>
      </div>
    );
  }

  if (embedHtml) {
    // Clean Facebook embeds to remove stats footer
    const platform = detectPlatform(expandedUrl);
    const cleanedHtml = platform === 'facebook' ? cleanFacebookHtml(embedHtml) : embedHtml;
    
    return (
      <div className="relative w-full overflow-hidden [&>*]:block [&>*]:!m-0">
        <RawEmbedRenderer embedHtml={cleanedHtml} />
      </div>
    );
  }

  // Show fallback if no embed HTML or if embed failed
  const platform = detectPlatform(expandedUrl);
  const platformName = platform === 'instagram' ? 'Instagram' : 
                       platform === 'facebook' ? 'Facebook' :
                       platform === 'spotify' ? 'Spotify' :
                       platform === 'reddit' ? 'Reddit' :
                       platform === 'quora' ? 'Quora' :
                       platform === 'medium' ? 'Medium' :
                       platform === 'blog' ? 'Blog' : 'Web';

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
