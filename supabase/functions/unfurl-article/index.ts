import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TTL_HOURS = 24;

// Extract meta tag content
const extractMetaContent = (html: string, property: string, attr = 'property'): string | null => {
  const regex = new RegExp(`<meta\\s+${attr}=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
  const reverseRegex = new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+${attr}=["']${property}["']`, 'i');
  const match = html.match(regex) || html.match(reverseRegex);
  return match ? match[1] : null;
};

// Extract title
const extractTitle = (html: string): string => {
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle) return ogTitle;
  
  const twitterTitle = extractMetaContent(html, 'twitter:title', 'name');
  if (twitterTitle) return twitterTitle;
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1] : '';
};

// Extract first image from content
const extractFirstContentImage = (html: string): string | null => {
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : null;
};

// Extract first few sentences from content
const extractTextExcerpt = (html: string, maxChars = 260): string => {
  // Remove scripts, styles, and tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  
  // Take first 2-3 sentences (approx)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let excerpt = '';
  for (const sentence of sentences.slice(0, 3)) {
    if (excerpt.length + sentence.length <= maxChars) {
      excerpt += sentence;
    } else {
      break;
    }
  }
  
  if (excerpt.length === 0 && text.length > 0) {
    excerpt = text.substring(0, maxChars);
    if (text.length > maxChars) excerpt += '...';
  }
  
  return excerpt.trim();
};

// Extract article content using simple heuristics
const extractArticleContent = (html: string): string => {
  // Remove scripts and styles
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Try to find main content areas
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];
  
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  
  // Look for divs with common content class names
  const contentRegex = /<div[^>]*class=["'][^"']*(?:post|article|content|entry|story)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i;
  const contentMatch = cleaned.match(contentRegex);
  
  return contentMatch ? contentMatch[1] : '';
};

// Sanitize HTML
const sanitizeHtml = (html: string): string => {
  // Remove scripts, styles, iframes
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  // Remove event handlers
  html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  // Remove javascript: protocol
  html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
  return html;
};

// Clean malformed URLs (handle duplicates, spaces, etc.)
const cleanUrl = (url: string): string => {
  if (!url) return url;
  
  // Trim and take first segment if there are spaces/duplicates
  const cleaned = url.trim().split(/\s+/)[0];
  
  // Ensure it has a protocol
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return `https://${cleaned}`;
  }
  
  return cleaned;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url: rawUrl } = await req.json();

    if (!rawUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the URL before processing
    const targetUrl = cleanUrl(rawUrl);
    console.log('[unfurl-article] Processing URL:', targetUrl);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Check cache first
    const { data: cached } = await supabase
      .from('link_previews')
      .select('*')
      .eq('url', targetUrl)
      .single();

    if (cached) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);
      
      if (cacheAgeHours < TTL_HOURS) {
        console.log('[unfurl-article] Cache hit, age:', cacheAgeHours.toFixed(2), 'hours');
        return new Response(
          JSON.stringify(cached.data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[unfurl-article] Cache expired, refetching');
    }

    // Detect platform and kind
    const urlLower = targetUrl.toLowerCase();
    let kind = 'generic-article';
    
    if (urlLower.includes('reddit.com/r/') && (urlLower.includes('/comments/') || urlLower.includes('/s/'))) {
      kind = 'reddit-post';
    } else if (urlLower.includes('medium.com') || urlLower.includes('/@')) {
      kind = 'medium-article';
    } else if (urlLower.includes('quora.com')) {
      kind = 'quora-post';
    }

    console.log('[unfurl-article] Detected kind:', kind);

    // Multi-strategy approach for fetching content
    let html = '';
    let resolvedUrl = targetUrl;
    
    if (kind === 'quora-post') {
      console.log('[unfurl-article] Attempting Quora fetch with multiple strategies');
      
      // Strategy 1: Mobile user agent (less protection)
      const mobileHeaders = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      };
      
      try {
        console.log('[unfurl-article] Strategy 1: Mobile user agent');
        const mobileResponse = await fetch(targetUrl, {
          headers: mobileHeaders,
          redirect: 'follow',
        });
        
        console.log('[unfurl-article] Mobile response status:', mobileResponse.status);
        
        if (mobileResponse.ok) {
          html = await mobileResponse.text();
          resolvedUrl = mobileResponse.url;
          console.log('[unfurl-article] Success with mobile user agent, HTML length:', html.length);
        } else {
          throw new Error(`Mobile fetch failed: ${mobileResponse.status}`);
        }
      } catch (mobileError) {
        console.log('[unfurl-article] Mobile strategy failed:', mobileError instanceof Error ? mobileError.message : String(mobileError));
        
        // Strategy 2: Desktop with enhanced headers
        const desktopHeaders = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
        };
        
        try {
          console.log('[unfurl-article] Strategy 2: Enhanced desktop headers');
          const desktopResponse = await fetch(targetUrl, {
            headers: desktopHeaders,
            redirect: 'follow',
          });
          
          console.log('[unfurl-article] Desktop response status:', desktopResponse.status);
          
          if (desktopResponse.ok) {
            html = await desktopResponse.text();
            resolvedUrl = desktopResponse.url;
            console.log('[unfurl-article] Success with desktop headers, HTML length:', html.length);
          } else {
            throw new Error(`Desktop fetch failed: ${desktopResponse.status}`);
          }
        } catch (desktopError) {
          console.log('[unfurl-article] Desktop strategy failed:', desktopError instanceof Error ? desktopError.message : String(desktopError));
          
          // Strategy 3: r.jina.ai proxy
          try {
            console.log('[unfurl-article] Strategy 3: Using r.jina.ai proxy');
            const jinaUrl = `https://r.jina.ai/${targetUrl}`;
            const jinaResponse = await fetch(jinaUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              redirect: 'follow',
            });
            
            console.log('[unfurl-article] Jina response status:', jinaResponse.status);
            
            if (jinaResponse.ok) {
              html = await jinaResponse.text();
              resolvedUrl = targetUrl; // Use original URL
              console.log('[unfurl-article] Success with r.jina.ai proxy, HTML length:', html.length);
              console.log('[unfurl-article] HTML sample (first 500 chars):', html.substring(0, 500));
            } else {
              throw new Error(`Jina fetch failed: ${jinaResponse.status}`);
            }
          } catch (jinaError) {
            console.log('[unfurl-article] All strategies failed for Quora:', jinaError instanceof Error ? jinaError.message : String(jinaError));
            // Return minimal data with placeholder
            return new Response(
              JSON.stringify({
                kind,
                resolvedUrl: targetUrl,
                site: {
                  name: 'Quora',
                  domain: new URL(targetUrl).hostname,
                  favicon: 'https://qsf.cf2.quoracdn.net/-4-images.favicon.ico-26-8c912802e29ec03e.ico',
                },
                meta: {
                  title: 'Quora Post',
                  description: 'Content blocked by Quora protection',
                  image: null,
                  publishedTime: null,
                },
                content: {
                  html: '',
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    } else {
      // For non-Quora sites, use standard fetch
      const standardHeaders = {
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
      };
      
      const response = await fetch(targetUrl, {
        headers: standardHeaders,
        redirect: 'follow',
      });

      if (!response.ok) {
        console.log('[unfurl-article] HTTP error:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      html = await response.text();
      resolvedUrl = response.url;
    }

    // Extract metadata
    const title = extractTitle(html);
    console.log('[unfurl-article] Extracted title:', title);
    
    // Description with fallback to content excerpt
    let description = extractMetaContent(html, 'og:description') || 
                     extractMetaContent(html, 'description', 'name') || 
                     extractMetaContent(html, 'twitter:description', 'name') || 
                     '';
    console.log('[unfurl-article] Extracted description:', description ? description.substring(0, 100) : 'none');
    
    // If no description, extract from content
    if (!description) {
      const articleContent = extractArticleContent(html);
      if (articleContent) {
        description = extractTextExcerpt(articleContent);
        console.log('[unfurl-article] Extracted description from content:', description.substring(0, 100));
      }
    }
    
    // Image with proper fallback chain
    let image = extractMetaContent(html, 'og:image') || 
               extractMetaContent(html, 'twitter:image', 'name') || 
               extractMetaContent(html, 'og:image:url') || 
               '';
    console.log('[unfurl-article] Extracted og:image:', image ? 'found' : 'none');
    
    // Fallback to first content image if no OG image
    if (!image) {
      const articleContent = extractArticleContent(html);
      if (articleContent) {
        const contentImage = extractFirstContentImage(articleContent);
        if (contentImage) {
          image = contentImage.startsWith('http') ? contentImage : new URL(contentImage, resolvedUrl).href;
          console.log('[unfurl-article] Found content image:', image);
        }
      }
    }
    
    const siteName = extractMetaContent(html, 'og:site_name') || 
                    new URL(resolvedUrl).hostname.replace('www.', '');
    const publishedTime = extractMetaContent(html, 'article:published_time') || 
                         extractMetaContent(html, 'published_time') || 
                         '';

    // Extract favicon
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
    const faviconHref = faviconMatch ? faviconMatch[1] : '/favicon.ico';
    const favicon = faviconHref.startsWith('http') ? faviconHref : new URL(faviconHref, resolvedUrl).href;

    // Extract and sanitize article content
    const articleContent = extractArticleContent(html);
    const articleHtml = sanitizeHtml(articleContent);

    const result = {
      kind,
      resolvedUrl,
      site: {
        name: siteName,
        domain: new URL(resolvedUrl).hostname,
        favicon,
      },
      meta: {
        title: title.trim(),
        description: description.trim(),
        image: image || null,
        publishedTime: publishedTime || null,
      },
      content: {
        html: articleHtml,
      },
    };

    console.log('[unfurl-article] Extracted data:', { kind, title: result.meta.title, hasContent: !!articleHtml });

    // Cache the result
    const { error: upsertError } = await supabase
      .from('link_previews')
      .upsert({ 
        url: targetUrl, 
        data: result,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'url' 
      });

    if (upsertError) {
      console.error('[unfurl-article] Cache error:', upsertError);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[unfurl-article] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to unfurl article',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
