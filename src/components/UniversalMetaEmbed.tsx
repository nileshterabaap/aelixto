import { useState, useEffect } from 'react';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { OgCardFallback } from '@/components/OgCardFallback';
import { supabase } from '@/integrations/supabase/client';

interface UniversalMetaEmbedProps {
  url: string;
}

const detectPlatform = (url: string): 'instagram' | 'facebook' | 'spotify' | 'reddit' | 'quora' | 'medium' | 'blog' | 'unknown' => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) return 'instagram';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) return 'facebook';
  if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) return 'spotify';
  if (urlLower.includes('reddit.com')) return 'reddit';
  if (urlLower.includes('quora.com')) return 'quora';
  if (urlLower.includes('medium.com')) return 'medium';
  if (urlLower.includes('blog') || urlLower.includes('.wordpress.com') || urlLower.includes('blogger.com') || 
      urlLower.includes('ghost.io') || urlLower.includes('substack.com')) return 'blog';
  return 'unknown';
};

const buildInstagramEmbed = (url: string): string => {
  return `<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="${url}" data-instgrm-version="14" style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);"><a href="${url}" style="background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank"></a></blockquote>`;
};

const buildFacebookEmbed = (url: string): string => {
  let cleanUrl = url;
  try {
    const urlObj = new URL(url);
    const essentialParams = ['story_fbid', 'id', 'fbid', 'post_id', 'v'];
    const params = new URLSearchParams(urlObj.search);
    const cleanParams = new URLSearchParams();
    essentialParams.forEach(param => {
      const value = params.get(param);
      if (value) cleanParams.set(param, value);
    });
    const queryString = cleanParams.toString();
    cleanUrl = `${urlObj.origin}${urlObj.pathname}${queryString ? '?' + queryString : ''}`;
  } catch (e) {
    console.error('[UniversalMetaEmbed] Failed to parse URL:', e);
  }
  const isVideo = cleanUrl.includes('/videos/') || cleanUrl.includes('/watch/') || cleanUrl.includes('/reel/');
  if (isVideo) return `<div class="fb-video" data-href="${cleanUrl}" data-width="500" data-show-text="true" data-lazy="true"></div>`;
  return `<div class="fb-post" data-href="${cleanUrl}" data-width="500" data-show-text="true" data-lazy="true"></div>`;
};

const buildSpotifyEmbed = (url: string): string => {
  let embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
  if (url.includes('/embed/')) embedUrl = url;
  return `<iframe style="border-radius:12px" src="${embedUrl}" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
};

export const UniversalMetaEmbed = ({ url }: UniversalMetaEmbedProps) => {
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [fallbackData, setFallbackData] = useState<{ title?: string; image?: string; description?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUrl, setExpandedUrl] = useState(url);
  const [showFallback, setShowFallback] = useState(false);
  const [embedProcessing, setEmbedProcessing] = useState(false);

  useEffect(() => {
    const processUrl = async () => {
      setIsLoading(true);
      setShowFallback(false);
      setEmbedHtml(null);
      setEmbedProcessing(false);
      
      try {
        const platform = detectPlatform(url);
        let finalUrl = url;

        const needsExpansion = url.includes('fb.watch') || url.includes('fb.me') || url.includes('bit.ly') || url.includes('pin.it') || (url.includes('facebook.com') && url.includes('/share/'));
        
        if (needsExpansion) {
          console.log('[UniversalMetaEmbed] Expanding URL:', url);
          const { data: expandData } = await supabase.functions.invoke('expand-url', { body: { url } });
          if (expandData?.finalUrl) {
            finalUrl = expandData.finalUrl;
            console.log('[UniversalMetaEmbed] Expanded to:', finalUrl);
          }
        }

        setExpandedUrl(finalUrl);

        if (platform === 'instagram') {
          setEmbedHtml(buildInstagramEmbed(finalUrl));
          setEmbedProcessing(true);
        } else if (platform === 'facebook') {
          // FACEBOOK FIX: Never use SDK embed, always fetch OG data for link card
          // The Facebook SDK doesn't work reliably with new /share/ URLs
          console.log('[UniversalMetaEmbed] Facebook detected, fetching OG data for:', finalUrl);
          const { data: ogData } = await supabase.functions.invoke('fetch-og', { body: { url: finalUrl } });
          if (ogData) {
            console.log('[UniversalMetaEmbed] Facebook OG data:', ogData);
            setFallbackData({
              title: ogData.meta?.title || ogData.title,
              image: ogData.meta?.image || ogData.image,
              description: ogData.meta?.description || ogData.description
            });
          }
        } else if (platform === 'spotify') {
          setEmbedHtml(buildSpotifyEmbed(finalUrl));
        } else {
          const { data: ogData } = await supabase.functions.invoke('fetch-og', { body: { url: finalUrl } });
          if (ogData) {
            setFallbackData({
              title: ogData.meta?.title || ogData.title,
              image: ogData.meta?.image || ogData.image,
              description: ogData.meta?.description || ogData.description
            });
          }
        }
      } catch (error) {
        console.error('[UniversalMetaEmbed] Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    processUrl();
  }, [url]);

  if (isLoading || (embedProcessing && !showFallback)) {
    return (
      <div className="rounded-2xl border-2 border-border bg-muted/30 animate-pulse">
        <div className="aspect-square w-full bg-muted/50" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-muted/50 rounded w-3/4" />
          <div className="h-4 bg-muted/50 rounded w-1/2" />
        </div>
      </div>
    );
  }

  // For Instagram, render the embed if available
  if (embedHtml && !showFallback) {
    return (
      <div className="relative w-full overflow-hidden [&>*]:block [&>*]:!m-0">
        <RawEmbedRenderer 
          embedHtml={embedHtml} 
          onError={async () => {
            setEmbedProcessing(false);
            if (!fallbackData) {
              console.log('[UniversalMetaEmbed] Embed failed, fetching OG fallback for:', expandedUrl);
              const { data: ogData } = await supabase.functions.invoke('fetch-og', { body: { url: expandedUrl } });
              if (ogData) {
                setFallbackData({
                  title: ogData.meta?.title || ogData.title,
                  image: ogData.meta?.image || ogData.image,
                  description: ogData.meta?.description || ogData.description
                });
              }
            }
            setShowFallback(true);
          }}
        />
      </div>
    );
  }

  const platform = detectPlatform(expandedUrl);
  const platformName = platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : platform === 'spotify' ? 'Spotify' : platform === 'reddit' ? 'Reddit' : platform === 'quora' ? 'Quora' : platform === 'medium' ? 'Medium' : platform === 'blog' ? 'Blog' : 'Web';

  return <OgCardFallback url={expandedUrl} title={fallbackData?.title} image={fallbackData?.image} description={fallbackData?.description} platform={platformName} />;
};
