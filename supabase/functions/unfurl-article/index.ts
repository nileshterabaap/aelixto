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

serve(async (req) => {
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

    // Fetch HTML with proper headers
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
      console.log('[unfurl-article] HTTP error:', response.status);
      // For 403/401, return as link-preview (don't try to embed)
      if (response.status === 403 || response.status === 401) {
        const siteName = new URL(targetUrl).hostname.replace('www.', '');
        const result = {
          kind: 'link-preview', // Special kind to force link card display
          resolvedUrl: targetUrl,
          site: {
            name: siteName,
            domain: new URL(targetUrl).hostname,
            favicon: new URL('/favicon.ico', targetUrl).href,
          },
          meta: {
            title: `View on ${siteName}`,
            description: targetUrl,
            image: null,
            publishedTime: null,
          },
          content: {
            html: '',
          },
        };
        
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const resolvedUrl = response.url;

    // Extract metadata
    const title = extractTitle(html);
    const description = extractMetaContent(html, 'og:description') || 
                       extractMetaContent(html, 'description', 'name') || 
                       extractMetaContent(html, 'twitter:description', 'name') || 
                       '';
    const image = extractMetaContent(html, 'og:image') || 
                 extractMetaContent(html, 'twitter:image', 'name') || 
                 extractMetaContent(html, 'og:image:url') || 
                 '';
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
