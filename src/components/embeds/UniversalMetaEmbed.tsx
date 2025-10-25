import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RawEmbedRenderer } from './RawEmbedRenderer';
import { OgCardFallback } from './OgCardFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { loadScript } from '@/lib/ScriptLoader';

interface UniversalMetaEmbedProps {
  url: string;
}

type Platform = 'instagram' | 'facebook' | 'unknown';

// Detect platform from URL
const detectPlatform = (url: string): Platform => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('instagr.am')) {
    return 'instagram';
  }
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerUrl.includes('fb.me')) {
    return 'facebook';
  }
  return 'unknown';
};

// Check if URL needs expansion (short links)
const needsExpansion = (url: string): boolean => {
  const shortDomains = ['fb.watch', 'fb.me', 'bit.ly', 'tinyurl.com', 'instagr.am'];
  return shortDomains.some(domain => url.includes(domain));
};

// Extract Instagram post ID from URL
const extractInstagramId = (url: string): string | null => {
  const match = url.match(/instagram\.com\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/);
  return match ? match[2] : null;
};

// Build Instagram embed HTML
const buildInstagramEmbed = (url: string): string => {
  return `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote>`;
};

// Build Facebook embed HTML
const buildFacebookEmbed = (url: string): string => {
  // Check if it's a video
  if (url.includes('/videos/') || url.includes('/watch/')) {
    return `<div class="fb-video" data-href="${url}" data-width="auto"></div>`;
  }
  // Default to post embed
  return `<div class="fb-post" data-href="${url}" data-width="auto"></div>`;
};

export const UniversalMetaEmbed = ({ url }: UniversalMetaEmbedProps) => {
  const [embedHtml, setEmbedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fallbackData, setFallbackData] = useState<{
    title?: string;
    image?: string;
    description?: string;
    finalUrl: string;
  } | null>(null);
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    const processUrl = async () => {
      try {
        setIsLoading(true);
        setError(false);
        
        let finalUrl = url;
        
        // Step 1: Expand URL if needed
        if (needsExpansion(url)) {
          console.log('[UniversalMetaEmbed] Expanding short URL:', url);
          const { data: expandData, error: expandError } = await supabase.functions.invoke('expand-url', {
            body: { url }
          });
          
          if (!expandError && expandData?.finalUrl) {
            finalUrl = expandData.finalUrl;
            console.log('[UniversalMetaEmbed] Expanded to:', finalUrl);
          }
        }
        
        // Step 2: Detect platform
        const detectedPlatform = detectPlatform(finalUrl);
        setPlatform(detectedPlatform);
        console.log('[UniversalMetaEmbed] Detected platform:', detectedPlatform);
        
        // Step 3: Build embed HTML based on platform
        let html = '';
        
        if (detectedPlatform === 'instagram') {
          html = buildInstagramEmbed(finalUrl);
          // Load Instagram embed script
          await loadScript('https://www.instagram.com/embed.js');
          if ((window as any).instgrm?.Embeds) {
            setTimeout(() => (window as any).instgrm.Embeds.process(), 100);
          }
          setEmbedHtml(html);
          setIsLoading(false);
          
          // Try to fetch OG data in background for potential fallback
          fetchOgDataInBackground(finalUrl);
        } else if (detectedPlatform === 'facebook') {
          // Facebook embeds require app registration - use OG card instead
          await fetchOgData(finalUrl);
        } else {
          // Unknown platform, fetch OG data immediately
          await fetchOgData(finalUrl);
        }
        
      } catch (err) {
        console.error('[UniversalMetaEmbed] Error processing URL:', err);
        // Try to fetch OG data as fallback
        await fetchOgData(url);
      }
    };
    
    const fetchOgData = async (targetUrl: string) => {
      try {
        const { data: ogData, error: ogError } = await supabase.functions.invoke('fetch-og', {
          body: { url: targetUrl }
        });
        
        if (!ogError && ogData) {
          setFallbackData({
            title: ogData.title,
            image: ogData.image,
            description: ogData.description,
            finalUrl: ogData.finalUrl || targetUrl
          });
          setError(true); // Show fallback
        } else {
          setError(true);
          setFallbackData({ finalUrl: targetUrl });
        }
      } catch (err) {
        console.error('[UniversalMetaEmbed] Error fetching OG data:', err);
        setError(true);
        setFallbackData({ finalUrl: targetUrl });
      } finally {
        setIsLoading(false);
      }
    };
    
    const fetchOgDataInBackground = async (targetUrl: string) => {
      try {
        const { data: ogData } = await supabase.functions.invoke('fetch-og', {
          body: { url: targetUrl }
        });
        
        if (ogData) {
          setFallbackData({
            title: ogData.title,
            image: ogData.image,
            description: ogData.description,
            finalUrl: ogData.finalUrl || targetUrl
          });
        }
      } catch (err) {
        console.log('[UniversalMetaEmbed] Background OG fetch failed:', err);
      }
    };
    
    processUrl();
  }, [url]);

  // Show loading state
  if (isLoading) {
    return <Skeleton className="w-full h-[500px] rounded-2xl" />;
  }

  // Show fallback if embed failed or for unknown platforms
  if (error || !embedHtml) {
    return (
      <OgCardFallback
        url={fallbackData?.finalUrl || url}
        title={fallbackData?.title}
        image={fallbackData?.image}
        description={fallbackData?.description}
        platform={platform}
      />
    );
  }

  // Render the embed
  return <RawEmbedRenderer embedHtml={embedHtml} />;
};
