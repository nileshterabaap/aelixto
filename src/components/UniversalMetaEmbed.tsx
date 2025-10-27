import { useState, useEffect } from 'react';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { OgCardFallback } from '@/components/OgCardFallback';
import { supabase } from '@/integrations/supabase/client';

interface UniversalMetaEmbedProps {
  url: string;
}

// Detect platform from URL
const detectPlatform = (url: string): 'instagram' | 'facebook' | 'unknown' => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
    return 'instagram';
  }
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
    return 'facebook';
  }
  return 'unknown';
};

// Build Instagram embed HTML
const buildInstagramEmbed = (url: string): string => {
  return `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote>`;
};

// Build Facebook embed HTML (post or video)
const buildFacebookEmbed = (url: string): string => {
  // Detect if it's a video or reel based on URL pattern
  if (url.includes('/videos/') || url.includes('/watch/') || url.includes('/reel/')) {
    return `<div class="fb-video" data-href="${url}" data-width="auto" data-show-text="true"></div>`;
  }
  return `<div class="fb-post" data-href="${url}" data-width="auto" data-show-text="true"></div>`;
};

export const UniversalMetaEmbed = ({ url }: UniversalMetaEmbedProps) => {
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [fallbackData, setFallbackData] = useState<{ title?: string; image?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUrl, setExpandedUrl] = useState(url);

  useEffect(() => {
    const processUrl = async () => {
      setIsLoading(true);
      
      try {
        // Step 1: Expand short URLs
        const platform = detectPlatform(url);
        let finalUrl = url;

        // Only expand if it's a short link
        if (url.includes('fb.watch') || url.includes('fb.me') || url.includes('bit.ly') || url.includes('pin.it')) {
          console.log('[UniversalMetaEmbed] Expanding short URL:', url);
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
          console.log('[UniversalMetaEmbed] Built Facebook embed');
        }

        // Step 3: Fetch OG data for fallback
        console.log('[UniversalMetaEmbed] Fetching OG data for fallback');
        const { data: ogData, error: ogError } = await supabase.functions.invoke('fetch-og', {
          body: { url: finalUrl }
        });

        if (!ogError && ogData) {
          setFallbackData({
            title: ogData.title,
            image: ogData.image
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

  // Try to render the embed
  if (embedHtml) {
    return (
      <div className="relative">
        <RawEmbedRenderer embedHtml={embedHtml} />
        {/* If embed fails to load after a timeout, we'll show fallback */}
      </div>
    );
  }

  // Show fallback if no embed HTML or if embed failed
  const platform = detectPlatform(expandedUrl);
  const platformName = platform === 'instagram' ? 'Instagram' : 
                       platform === 'facebook' ? 'Facebook' : 'Platform';

  return (
    <OgCardFallback 
      url={expandedUrl}
      title={fallbackData?.title}
      image={fallbackData?.image}
      platform={platformName}
    />
  );
};
