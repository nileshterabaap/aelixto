import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url: targetUrl } = await req.json();

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fetch-og] Fetching OG data for:', targetUrl);

    const urlLower = targetUrl.toLowerCase();
    
    // Try oEmbed APIs first for specific platforms (more reliable)
    if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) {
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          console.log('[fetch-og] Spotify oEmbed success:', oembed.thumbnail_url?.substring(0, 60));
          return new Response(
            JSON.stringify({ 
              title: oembed.title || 'Spotify', 
              image: oembed.thumbnail_url || null, 
              description: oembed.provider_name || 'Listen on Spotify',
              finalUrl: targetUrl 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.log('[fetch-og] Spotify oEmbed failed, falling back to HTML');
      }
    }
    
    if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
      // For Pinterest short URLs, first expand them
      let expandedUrl = targetUrl;
      if (urlLower.includes('pin.it')) {
        try {
          const expandRes = await fetch(targetUrl, { method: 'HEAD', redirect: 'follow' });
          expandedUrl = expandRes.url;
          console.log('[fetch-og] Pinterest expanded URL:', expandedUrl);
        } catch (e) {
          console.log('[fetch-og] Pinterest URL expansion failed');
        }
      }
      
      // Extract pin ID and try to get image
      const pinIdMatch = expandedUrl.match(/\/pin\/(\d+)/);
      if (pinIdMatch) {
        // Pinterest doesn't have public oEmbed, but we can construct image URL
        console.log('[fetch-og] Pinterest pin ID:', pinIdMatch[1]);
      }
    }
    
    if (urlLower.includes('reddit.com') || urlLower.includes('redd.it')) {
      // Use Reddit's JSON API via old.reddit.com - more reliable
      try {
        // Convert to old.reddit.com and append .json
        let jsonUrl = targetUrl.split('?')[0]; // Remove query params
        jsonUrl = jsonUrl.replace('www.reddit.com', 'old.reddit.com');
        if (!jsonUrl.endsWith('/')) jsonUrl += '/';
        jsonUrl += '.json';
        
        console.log('[fetch-og] Trying Reddit JSON:', jsonUrl);
        
        const redditRes = await fetch(jsonUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          }
        });
        
        console.log('[fetch-og] Reddit response status:', redditRes.status);
        
        if (redditRes.ok) {
          const data = await redditRes.json();
          const post = data?.[0]?.data?.children?.[0]?.data;
          if (post) {
            // Reddit provides thumbnail or preview images
            let thumbnail = null;
            if (post.preview?.images?.[0]?.source?.url) {
              thumbnail = post.preview.images[0].source.url.replace(/&amp;/g, '&');
            } else if (post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' && post.thumbnail !== 'nsfw' && post.thumbnail !== 'spoiler') {
              thumbnail = post.thumbnail;
            }
            
            console.log('[fetch-og] Reddit JSON API success:', thumbnail?.substring(0, 60) || 'no image');
            return new Response(
              JSON.stringify({ 
                title: post.title || 'Reddit Post', 
                image: thumbnail, 
                description: post.author ? `Posted by u/${post.author}` : 'View on Reddit',
                finalUrl: targetUrl 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (e) {
        console.log('[fetch-og] Reddit JSON API failed, falling back to HTML:', e);
      }
    }
    
    // Twitter/X - use syndication API for thumbnails
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      try {
        // Extract tweet ID
        const tweetIdMatch = targetUrl.match(/status\/(\d+)/);
        if (tweetIdMatch) {
          const tweetId = tweetIdMatch[1];
          // Use Twitter's syndication API
          const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`;
          
          const twitterRes = await fetch(syndicationUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          
          if (twitterRes.ok) {
            const tweet = await twitterRes.json();
            let thumbnail = null;
            
            // Check for media in tweet
            if (tweet.mediaDetails?.[0]?.media_url_https) {
              thumbnail = tweet.mediaDetails[0].media_url_https;
            } else if (tweet.photos?.[0]?.url) {
              thumbnail = tweet.photos[0].url;
            } else if (tweet.video?.poster) {
              thumbnail = tweet.video.poster;
            } else if (tweet.user?.profile_image_url_https) {
              // Fallback to profile image (get larger version)
              thumbnail = tweet.user.profile_image_url_https.replace('_normal', '_400x400');
            }
            
            console.log('[fetch-og] Twitter syndication success:', thumbnail?.substring(0, 60));
            return new Response(
              JSON.stringify({ 
                title: tweet.text?.substring(0, 100) || 'Tweet', 
                image: thumbnail, 
                description: tweet.user?.name ? `@${tweet.user.screen_name}` : 'View on X',
                finalUrl: targetUrl 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (e) {
        console.log('[fetch-og] Twitter syndication failed:', e);
      }
    }

    // Fetch the HTML with better headers to avoid 403 blocks
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      // If blocked (403/401), return platform-specific placeholders
      if (response.status === 403 || response.status === 401) {
        console.log('[fetch-og] Blocked by site, returning platform placeholder');
        
        const urlLower = targetUrl.toLowerCase();
        let platformName = 'Web';
        let placeholderImage = 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=1200&h=630&fit=crop';
        
        if (urlLower.includes('quora.com')) {
          platformName = 'Quora';
          placeholderImage = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=630&fit=crop';
        } else if (urlLower.includes('reddit.com')) {
          platformName = 'Reddit';
          placeholderImage = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&h=630&fit=crop';
        } else if (urlLower.includes('medium.com')) {
          platformName = 'Medium';
          placeholderImage = 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&h=630&fit=crop';
        }
        
        return new Response(
          JSON.stringify({ 
            title: `${platformName} Post`,
            image: placeholderImage,
            description: `View this post on ${platformName}`,
            finalUrl: targetUrl
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const finalUrl = response.url;

    // Helper to decode HTML entities
    const decodeHtmlEntities = (text: string): string => {
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
    };

    // Extract Open Graph metadata with multiple fallbacks (handle both attribute orders)
    // Pattern 1: property="og:X" content="Y"
    // Pattern 2: content="Y" property="og:X"
    const extractMeta = (propName: string): string | null => {
      // Try property first, then name
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${propName}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${propName}["']`, 'i'),
        new RegExp(`<meta[^>]+name=["']${propName}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${propName}["']`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return decodeHtmlEntities(match[1]);
      }
      return null;
    };
    
    // Try multiple property names for each field
    const title = extractMeta('og:title') || extractMeta('twitter:title') || 
                  (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ? decodeHtmlEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)![1]) : null);
    
    const image = extractMeta('og:image') || extractMeta('og:image:url') || 
                  extractMeta('og:image:secure_url') || extractMeta('twitter:image') ||
                  extractMeta('twitter:image:src');
    
    const description = extractMeta('og:description') || extractMeta('twitter:description') || 
                        extractMeta('description');

    console.log('[fetch-og] Extracted OG data:', { title, image, description, finalUrl });

    return new Response(
      JSON.stringify({ title, image, description, finalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fetch-og] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Open Graph data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
