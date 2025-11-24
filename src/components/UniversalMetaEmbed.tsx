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
  // Use Instagram's recommended embed format with captioned attribute
  return `<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="${url}" data-instgrm-version="14" style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);"><a href="${url}" style="background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank"></a></blockquote>`;
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

  // 2) If it's an l.facebook.com redirect, extract the "u" param
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

  // 3) Strip tracking / share junk that shouldn't affect the canonical post
  const stripParams = [
    'mibextid',
    'ref',
    'refid',
    'sfnsn',
    'app',
    'paipv',
  ];
  
  try {
    const u2 = new URL(url);
    stripParams.forEach(p => u2.searchParams.delete(p));
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
    embedType: 'sdk-xfbml-div'
  });
  
  // Use Facebook SDK approach with <div class="fb-post"> - this is what works!
  return `<div class="fb-post" data-href="${canonical}" data-width="500" data-show-text="true"></div>`;
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

export const UniversalMetaEmbed = ({ url }: UniversalMetaEmbedProps) => {
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [fallbackData, setFallbackData] = useState<{ title?: string; image?: string; description?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUrl, setExpandedUrl] = useState(url);
  const [embedUrl, setEmbedUrl] = useState(url); // Separate URL for embedding
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const processUrl = async () => {
      setIsLoading(true);
      setShowFallback(false);
      setEmbedHtml(null);
      
      try {
        const platform = detectPlatform(url);
        let finalUrl = url;
        let urlForEmbed = url;

        // Step 1: Expand short URLs and Facebook share URLs
        const needsExpansion = url.includes('fb.watch') || url.includes('fb.me') || 
                               url.includes('bit.ly') || url.includes('pin.it') ||
                               (url.includes('facebook.com') && url.includes('/share/'));
        
        if (needsExpansion) {
          console.log('[UniversalMetaEmbed] Expanding URL:', url);
          try {
            const { data: expandData, error: expandError } = await supabase.functions.invoke('expand-url', {
              body: { url }
            });

            if (!expandError && expandData?.finalUrl) {
              finalUrl = expandData.finalUrl;
              urlForEmbed = finalUrl;
              console.log('[UniversalMetaEmbed] Expanded to:', finalUrl);
              
              // If expanded URL is a login redirect, use fallback
              if (finalUrl.includes('/login/') && platform === 'facebook') {
                console.log('[UniversalMetaEmbed] Expanded URL is login redirect, will use fallback');
                setShowFallback(true);
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
        supabase.functions.invoke('fetch-og', {
          body: { url: finalUrl }
        }).then(({ data: ogData, error: ogError }) => {
          if (!ogError && ogData) {
            setFallbackData({
              title: ogData.meta?.title || ogData.title,
              image: ogData.meta?.image || ogData.image,
              description: ogData.meta?.description || ogData.description
            });
          }
        }).catch(err => console.warn('[UniversalMetaEmbed] OG fetch failed:', err));

        // Step 3: Build embed HTML based on platform (skip if already showing fallback)
        if (!showFallback) {
          if (platform === 'instagram') {
            const html = buildInstagramEmbed(urlForEmbed);
            setEmbedHtml(html);
            console.log('[UniversalMetaEmbed] Built Instagram embed');
          } else if (platform === 'facebook') {
            const html = buildFacebookEmbed(urlForEmbed);
            setEmbedHtml(html);
            console.log('[FB EMBED] Built Facebook SDK embed');
          } else if (platform === 'spotify') {
            const html = buildSpotifyEmbed(urlForEmbed);
            setEmbedHtml(html);
            console.log('[UniversalMetaEmbed] Built Spotify embed');
          }
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

  if (embedHtml && !showFallback) {
    console.log('[UniversalMetaEmbed] Rendering embed, showFallback:', showFallback);
    
    // For Spotify only, render directly without RawEmbedRenderer
    const isSpotifyIframe = embedHtml.includes('open.spotify.com/embed');
    
    if (isSpotifyIframe) {
      return (
        <div 
          className="relative w-full overflow-hidden [&>iframe]:w-full [&>iframe]:block"
          dangerouslySetInnerHTML={{ __html: embedHtml }}
        />
      );
    }
    
    // For Instagram AND Facebook, use RawEmbedRenderer for SDK processing
    return (
      <div className="relative w-full overflow-hidden [&>*]:block [&>*]:!m-0">
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
  
  console.log('[UniversalMetaEmbed] Showing fallback, showFallback:', showFallback, 'embedHtml exists:', !!embedHtml);

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
