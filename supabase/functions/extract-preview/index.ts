import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSRF Protection: block internal / private network targets
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    const blocked = ['localhost', 'metadata.google.internal', 'metadata.google', '169.254.169.254', 'instance-data'];
    if (blocked.includes(hostname)) return false;
    const privateIp = [
      /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
      /^169\.254\./, /^0\./, /^::1$/, /^fc00:/, /^fe80:/, /^fd/,
    ];
    return !privateIp.some((r) => r.test(hostname));
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidExternalUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or disallowed URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-preview] Fetching preview for:', url);

    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AelixtoBot/1.0; +https://aelixto.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract Open Graph and Twitter Card metadata
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ||
                    html.match(/<meta\s+name="twitter:title"\s+content="([^"]+)"/i)?.[1] ||
                    html.match(/<title>([^<]+)<\/title>/i)?.[1];

    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ||
                    html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i)?.[1];

    const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)?.[1] ||
                          html.match(/<meta\s+name="twitter:description"\s+content="([^"]+)"/i)?.[1] ||
                          html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];

    // Extract main content text (first 2-3 sentences)
    let previewText = ogDescription || '';
    
    if (!previewText) {
      // Try to extract from article body
      const bodyMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                       html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                       html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

      if (bodyMatch) {
        // Remove scripts, styles, and HTML tags
        let cleanText = bodyMatch[1]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Get first ~200 characters
        if (cleanText.length > 200) {
          previewText = cleanText.substring(0, 200).trim();
          // Find the last sentence end
          const lastPeriod = previewText.lastIndexOf('.');
          const lastQuestion = previewText.lastIndexOf('?');
          const lastExclamation = previewText.lastIndexOf('!');
          const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
          
          if (lastSentenceEnd > 100) {
            previewText = previewText.substring(0, lastSentenceEnd + 1);
          } else {
            previewText += '...';
          }
        } else {
          previewText = cleanText;
        }
      }
    }

    // Decode HTML entities
    const decodeHtmlEntities = (text: string) => {
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
    };

    const result = {
      preview_title: ogTitle ? decodeHtmlEntities(ogTitle) : null,
      preview_image_url: ogImage || null,
      preview_text: previewText ? decodeHtmlEntities(previewText) : null
    };

    console.log('[extract-preview] Extracted:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[extract-preview] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});