import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TTL_HOURS = 24;

// SSRF Protection: Validate URLs to prevent internal network access
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.log('[unfurl-article] Rejected non-HTTP protocol:', parsed.protocol);
      return false;
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and common internal hostnames
    const blockedHostnames = [
      'localhost', 
      'metadata.google.internal',
      'metadata.google',
      '169.254.169.254',
      'instance-data',
    ];
    
    if (blockedHostnames.includes(hostname)) {
      console.log('[unfurl-article] Rejected blocked hostname:', hostname);
      return false;
    }
    
    // Block private IP ranges
    const privateIpPatterns = [
      /^127\./, // Loopback
      /^10\./, // Class A private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
      /^192\.168\./, // Class C private
      /^169\.254\./, // Link-local
      /^0\./, // Current network
      /^::1$/, // IPv6 loopback
      /^fc00:/, // IPv6 unique local
      /^fe80:/, // IPv6 link-local
      /^fd/, // IPv6 private
    ];
    
    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        console.log('[unfurl-article] Rejected private IP:', hostname);
        return false;
      }
    }
    
    return true;
  } catch {
    console.log('[unfurl-article] Failed to parse URL');
    return false;
  }
}

// Decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#39;': "'",
    '&apos;': "'",
    '&hellip;': '…',
    '&ndash;': '–',
    '&mdash;': '—',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities like &#39;
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  // Handle hex entities like &#x27;
  decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return decoded;
};

// Extract meta tag content
const extractMetaContent = (html: string, property: string, attr = 'property'): string | null => {
  // Tolerant parser: iterate every <meta ...> tag and match attributes in any order,
  // with any extra attributes in between (data-*, id, class, charset, etc.).
  const want = property.toLowerCase();
  const wantAttrs = attr === 'name' ? ['name'] : ['property', 'name', 'itemprop'];
  const tagRegex = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(html)) !== null) {
    const tag = m[0];
    const propMatch = tag.match(/\s(property|name|itemprop)\s*=\s*["']?([^"'\s>]+)["']?/i);
    if (!propMatch) continue;
    if (!wantAttrs.includes(propMatch[1].toLowerCase())) continue;
    if (propMatch[2].toLowerCase() !== want) continue;
    const contentMatch =
      tag.match(/\scontent\s*=\s*"([^"]*)"/i) ||
      tag.match(/\scontent\s*=\s*'([^']*)'/i) ||
      tag.match(/\scontent\s*=\s*([^\s>]+)/i);
    if (contentMatch?.[1]) return decodeHtmlEntities(contentMatch[1]).trim();
  }
  return null;
};

// Extract title - prioritize actual article H1
const extractTitle = (html: string): string => {
  // First try to find H1 in article/main content
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const contentSection = articleMatch ? articleMatch[1] : (mainMatch ? mainMatch[1] : html);
  
  const h1Match = contentSection.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1].trim()) {
    return decodeHtmlEntities(h1Match[1].trim());
  }
  
  // Fallback to meta tags
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle) return ogTitle;
  
  const twitterTitle = extractMetaContent(html, 'twitter:title', 'name');
  if (twitterTitle) return twitterTitle;
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1] : '';
};

// Heuristic: skip icons, logos, trackers, tiny sprites
const isLikelyRealContentImage = (url: string): boolean => {
  if (!url) return false;
  const u = url.trim();
  if (!u || u.startsWith('data:')) return false;
  if (/\.svg(\?|#|$)/i.test(u)) return false;
  const lower = u.toLowerCase();
  const blocked = ['sprite','icon','favicon','logo','avatar','profile-photo','blank.gif','spacer.gif','pixel.gif','1x1','tracking','analytics','badge','emoji'];
  if (blocked.some((h) => lower.includes(h))) return false;
  if (/[?&=_/-](?:w|width)=(?:8|16|24|32|48|64)\b/i.test(u)) return false;
  return true;
};

// Extract first real content image from HTML (article/main first, then any img)
const extractFirstContentImage = (html: string): string | null => {
  const scopes: string[] = [];
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) scopes.push(articleMatch[0]);
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  if (mainMatch) scopes.push(mainMatch[0]);
  scopes.push(html);
  for (const scope of scopes) {
    const imgRegex = /<img\b[^>]+>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRegex.exec(scope)) !== null) {
      const tag = m[0];
      const src =
        tag.match(/\s(?:data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["']/i)?.[1] ||
        tag.match(/\s(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/i)?.[1] ||
        tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!src) continue;
      const candidate = decodeHtmlEntities(src.split(',')[0].trim().split(/\s+/)[0]);
      if (isLikelyRealContentImage(candidate)) return candidate;
    }
  }
  return null;
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
  
  // Strategy 1: Try to find article tag
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    console.log('[extractArticleContent] Found <article> tag, length:', articleMatch[1].length);
    return articleMatch[1];
  }
  
  // Strategy 2: Try to find main tag
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    console.log('[extractArticleContent] Found <main> tag, length:', mainMatch[1].length);
    return mainMatch[1];
  }
  
  // Strategy 3: Look for divs with common content class/id names (more patterns)
  const contentPatterns = [
    /<div[^>]*(?:class|id)=["'][^"']*(?:post-content|article-content|entry-content|post-body|article-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*(?:class|id)=["'][^"']*(?:content|main-content|primary-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*(?:class|id)=["'][^"']*(?:post|article|entry|story)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];
  
  for (const pattern of contentPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1].length > 200) {
      console.log('[extractArticleContent] Found content div with pattern, length:', match[1].length);
      return match[1];
    }
  }
  
  // Strategy 4: Find the body content, remove header/footer/nav/aside
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    let bodyContent = bodyMatch[1];
    // Remove common non-content elements
    bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    bodyContent = bodyContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
    
    console.log('[extractArticleContent] Using cleaned body content, length:', bodyContent.length);
    return bodyContent;
  }
  
  console.log('[extractArticleContent] No content found, returning empty');
  return '';
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

const normalizeImageCandidate = (raw?: string | null, baseUrl?: string): string | null => {
  if (!raw) return null;
  let src = decodeHtmlEntities(String(raw))
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .trim();

  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return null;
  src = src.split(',')[0].trim().split(/\s+/)[0];
  if (!src) return null;

  try {
    return baseUrl ? new URL(src, baseUrl).href : new URL(src).href;
  } catch {
    return null;
  }
};

const extractImageFromImgTag = (tag: string, baseUrl?: string): string | null => {
  const attrs = [
    'data-src',
    'data-original',
    'data-lazy-src',
    'data-testid-src',
    'data-image-src',
    'srcset',
    'data-srcset',
    'src',
  ];

  for (const attr of attrs) {
    const match = tag.match(new RegExp(`\\s${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
    const normalized = normalizeImageCandidate(match?.[1], baseUrl);
    if (normalized) return normalized;
  }

  return null;
};

const extractQuoraImageFromText = (text: string, baseUrl: string): string | null => {
  if (!text) return null;
  const candidates: string[] = [];
  const patterns = [
    /https?:\\?\/\\?\/(?:qph\.[^\s"'<>\\)]+|[^\s"'<>\\)]*quoracdn\.net[^\s"'<>\\)]*)/gi,
    /https?:\\u002f\\u002f(?:qph\.[^\s"'<>\\)]+|[^\s"'<>\\)]*quoracdn\.net[^\s"'<>\\)]*)/gi,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      candidates.push(m[0]);
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeImageCandidate(candidate, baseUrl);
    if (normalized && isLikelyRealContentImage(normalized)) return normalized;
  }

  return null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url: rawUrl, bustCache } = await req.json();

    if (!rawUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean the URL before processing
    const targetUrl = cleanUrl(rawUrl);
    
    // SSRF Protection: Validate URL before fetching
    if (!isValidExternalUrl(targetUrl)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or blocked URL' }),
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

    if (cached && !bustCache) {
      const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);

      // Refresh stale Quora cache entries that never captured an image so
      // the improved scraper has a chance to fill it in.
      const cachedData: any = cached.data;
      const isEmptyQuora =
        cachedData?.kind === 'quora-post' && !cachedData?.meta?.image;

      if (cacheAgeHours < TTL_HOURS && !isEmptyQuora) {
        console.log('[unfurl-article] Cache hit, age:', cacheAgeHours.toFixed(2), 'hours');
        return new Response(
          JSON.stringify(cached.data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[unfurl-article] Cache expired or empty Quora image, refetching');
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
      console.log('[unfurl-article] Quora: routing directly to Firecrawl');

      const slugTitle = (() => {
        try {
          const u = new URL(targetUrl);
          const parts = u.pathname.split('/').filter(Boolean);
          const last = parts[parts.length - 1];
          if (last) {
            return last
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
          }
        } catch { /* ignore */ }
        return 'Quora Post';
      })();

      const quoraFavicon = 'https://qsf.cf2.quoracdn.net/-4-images.favicon.ico-26-8c912802e29ec03e.ico';
      const quoraDomain = (() => { try { return new URL(targetUrl).hostname; } catch { return 'quora.com'; } })();

      const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
      let fcTitle = '';
      let fcImage: string | null = null;
      let fcDescription = '';
      let fcPublished: string | null = null;

      if (fcKey) {
        try {
          // Bound Firecrawl to ~10s so a slow Quora scrape doesn't stall
          // the whole client render. The synthesized card is still returned.
          const fcAbort = new AbortController();
          const fcTimer = setTimeout(() => fcAbort.abort(), 10_000);
          const fc = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${fcKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: targetUrl,
              formats: ['markdown', 'html'],
              onlyMainContent: false,
              waitFor: 1500,
            }),
            signal: fcAbort.signal,
          }).finally(() => clearTimeout(fcTimer));

          if (fc.ok) {
            const fcData = await fc.json();
            const payload = fcData?.data ?? fcData;
            const md: string = payload?.markdown || '';
            const fcHtml: string = payload?.html || payload?.rawHtml || '';
            const meta = payload?.metadata || {};

            // Title: og:title -> metadata.title -> first markdown # heading -> slug
            fcTitle = (meta.ogTitle || meta.title || '').trim();
            if (!fcTitle && md) {
              const h = md.match(/^#\s+(.+)$/m);
              if (h) fcTitle = h[1].trim();
            }
            // Strip trailing " - Quora"
            fcTitle = fcTitle.replace(/\s*-\s*Quora\s*$/i, '').trim();
            if (!fcTitle) fcTitle = slugTitle;

            // Image extraction (in priority order):
            // 1) og:image / twitter:image from metadata
            // 2) First Quora-CDN <img> in HTML that isn't an avatar/UI sprite
            // 3) First Quora-CDN image referenced in the markdown (![](url))
            // 4) First non-avatar https <img> of any host
            const ogImage =
              meta.ogImage ||
              meta['og:image'] ||
              meta.twitterImage ||
              meta['twitter:image'] ||
              meta.image ||
              '';
            // Quora frequently sets og:image to the *answer author's profile
            // photo*, which is hosted on the same qph/quoracdn hosts as real
            // content images, so URL shape alone cannot tell them apart.
            // Collect the avatars declared in the scraped body (alt text
            // "Profile photo for X", or tiny <img> dimensions) and treat any
            // matching candidate as an avatar, never as the post thumbnail.
            const avatarUrls = new Set<string>();
            const rememberAvatar = (src: string | null | undefined) => {
              if (!src) return;
              const normalized = normalizeImageCandidate(src, targetUrl);
              if (normalized) avatarUrls.add(normalized.split('?')[0]);
            };
            if (fcHtml) {
              const imgTagRegex = /<img\b[^>]*>/gi;
              let am: RegExpExecArray | null;
              while ((am = imgTagRegex.exec(fcHtml)) !== null) {
                const tag = am[0];
                const alt = tag.match(/\salt=["']([^"']*)["']/i)?.[1] || '';
                const w = parseInt(tag.match(/\swidth=["']?(\d+)/i)?.[1] || '0', 10);
                const h = parseInt(tag.match(/\sheight=["']?(\d+)/i)?.[1] || '0', 10);
                const looksAvatar =
                  /profile photo|profile picture|avatar/i.test(alt) ||
                  (w > 0 && w <= 120) ||
                  (h > 0 && h <= 120);
                if (looksAvatar) rememberAvatar(extractImageFromImgTag(tag, targetUrl));
              }
            }
            if (md) {
              const mdAvatar = /!\[([^\]]*(?:profile photo|profile picture|avatar)[^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;
              let am: RegExpExecArray | null;
              while ((am = mdAvatar.exec(md)) !== null) rememberAvatar(am[2]);
            }
            const isKnownAvatar = (src: string | null | undefined) =>
              !!src && avatarUrls.has(src.split('?')[0]);

            const normalizedOgImage = normalizeImageCandidate(ogImage, targetUrl);
            if (normalizedOgImage && /^https?:\/\//i.test(normalizedOgImage) && !isLikelyRealContentImage(normalizedOgImage)) {
              fcImage = null;
            } else if (normalizedOgImage && isKnownAvatar(normalizedOgImage)) {
              // og:image is the author's avatar — fall through to the body scans.
              fcImage = null;
            } else if (normalizedOgImage && /^https?:\/\//i.test(normalizedOgImage)) {
              fcImage = normalizedOgImage;
            }

            const isQuoraContentImg = (src: string) =>
              /(?:^|\.)quoracdn\.net\//i.test(src) || /\/\/qph\./i.test(src) || /main-qimg/i.test(src);
            const isJunkImg = (src: string) =>
              /\/-?\d-images\.|\bavatar\b|\bprofile\b|\bspacer\b|\b1x1\b|tracking|favicon|logo|sprite|emoji|default_user/i.test(src) ||
              isKnownAvatar(src);

            if (!fcImage && fcHtml) {
              const imgRegex = /<img\b[^>]*>/gi;
              let m: RegExpExecArray | null;
              while ((m = imgRegex.exec(fcHtml)) !== null) {
                const src = extractImageFromImgTag(m[0], targetUrl);
                if (!src) continue;
                if (!/^https?:\/\//i.test(src)) continue;
                if (!isQuoraContentImg(src)) continue;
                if (isJunkImg(src)) continue;
                fcImage = src;
                break;
              }
            }

            if (!fcImage && md) {
              const mdImg = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi;
              let m: RegExpExecArray | null;
              while ((m = mdImg.exec(md)) !== null) {
                const src = m[1];
                const normalized = normalizeImageCandidate(src, targetUrl);
                if (!normalized || isJunkImg(normalized)) continue;
                if (isQuoraContentImg(normalized)) { fcImage = normalized; break; }
                if (!fcImage && isLikelyRealContentImage(normalized)) fcImage = normalized; // remember as a last resort
              }
            }

            if (!fcImage && fcHtml) {
              const imgRegex = /<img\b[^>]*>/gi;
              let m: RegExpExecArray | null;
              while ((m = imgRegex.exec(fcHtml)) !== null) {
                const src = extractImageFromImgTag(m[0], targetUrl);
                if (!src) continue;
                if (!/^https?:\/\//i.test(src)) continue;
                if (isJunkImg(src)) continue;
                if (!isLikelyRealContentImage(src)) continue;
                fcImage = src;
                break;
              }
            }

            if (!fcImage) {
              fcImage = extractQuoraImageFromText(`${fcHtml}\n${md}\n${JSON.stringify(meta)}`, targetUrl);
            }

            // Description: first 2 meaningful sentences from markdown
            if (md) {
              const lines = md.split(/\n+/).map((l) => l.trim());
              const skip = /^(sign in|sign up|all related|more answers|related questions|continue with|by continuing|profile photo|upvote|downvote|share|comment|follow|view \d|\d+ answer|original question|loading|©|home|search)/i;
              const bodyLines: string[] = [];
              for (const l of lines) {
                if (!l) continue;
                if (l.startsWith('#')) continue;
                if (l.startsWith('![')) continue; // image markdown
                if (l.startsWith('[')) continue;  // link-only lines
                if (l.length < 40) continue;
                if (skip.test(l)) continue;
                bodyLines.push(l);
                if (bodyLines.length >= 2) break;
              }
              const joined = bodyLines.join(' ').replace(/\s+/g, ' ').trim();
              if (joined) {
                const sentences = joined.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
                fcDescription = sentences.length > 220
                  ? sentences.slice(0, 220).replace(/\s+\S*$/, '') + '…'
                  : sentences;
              }
            }

            fcPublished = meta.ogPublishedTime || meta.publishedTime || meta['article:published_time'] || null;
            console.log('[unfurl-article] Quora Firecrawl ok. title:', fcTitle.slice(0, 80), 'image:', !!fcImage, 'desc len:', fcDescription.length);
          } else {
            console.log('[unfurl-article] Quora Firecrawl HTTP', fc.status);
          }
        } catch (e) {
          console.log('[unfurl-article] Quora Firecrawl error:', e instanceof Error ? e.message : String(e));
        }
      } else {
        console.log('[unfurl-article] FIRECRAWL_API_KEY missing — returning minimal Quora card');
      }

      const result = {
          kind,
          resolvedUrl: targetUrl,
          site: { name: 'Quora', domain: quoraDomain, favicon: quoraFavicon },
          meta: {
            title: fcTitle || slugTitle,
            description: fcDescription,
            image: fcImage,
            publishedTime: fcPublished,
          },
          content: { html: '' },
        };

      const { error: upsertError } = await supabase
        .from('link_previews')
        .upsert({
          url: targetUrl,
          data: result,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'url',
        });

      if (upsertError) {
        console.error('[unfurl-article] Quora cache error:', upsertError);
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // For non-Quora sites, try a UA fallback chain to bypass anti-bot protections (Cloudflare, etc.)
      const buildHeaders = (ua: string) => ({
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      });

      const uaChain = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      ];

      let okResp: Response | null = null;
      let usedProxy = false;
      for (const ua of uaChain) {
        try {
          const r = await fetch(targetUrl, { headers: buildHeaders(ua), redirect: 'follow' });
          console.log('[unfurl-article] UA', ua, '->', r.status);
          if (r.ok) { okResp = r; break; }
        } catch (e) {
          console.log('[unfurl-article] UA error:', ua, e instanceof Error ? e.message : String(e));
        }
      }

      if (!okResp) {
        // Last-resort proxy fallback
        try {
          const jina = await fetch(`https://r.jina.ai/${targetUrl}`, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*' },
            redirect: 'follow',
          });
          if (jina.ok) {
            okResp = jina;
            usedProxy = true;
            resolvedUrl = targetUrl;
            console.log('[unfurl-article] Jina proxy succeeded');
          }
        } catch (e) {
          console.log('[unfurl-article] Jina proxy failed:', e instanceof Error ? e.message : String(e));
        }
      }

      // Final fallback: Firecrawl (bypasses Cloudflare / anti-bot challenges)
      if (!okResp) {
        const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
        if (fcKey) {
          try {
            console.log('[unfurl-article] Trying Firecrawl fallback');
            const fc = await fetch('https://api.firecrawl.dev/v2/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${fcKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: targetUrl,
                formats: ['html'],
                onlyMainContent: false,
              }),
            });
            if (fc.ok) {
              const data = await fc.json();
              const payload = data?.data || data || {};
              const md = payload.metadata || {};
              const fcHtml: string = payload.html || '';
              const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const title = md.ogTitle || md.title || '';
              const desc = md.ogDescription || md.description || '';
              const image = md.ogImage || md['og:image'] || md.image || '';
              const author = md.author || md.ogAuthor || '';
              const site = md.ogSiteName || md['og:site_name'] || '';
              const synth = `<html><head>
                ${title ? `<title>${esc(title)}</title>` : ''}
                ${title ? `<meta property="og:title" content="${esc(title)}">` : ''}
                ${desc ? `<meta property="og:description" content="${esc(desc)}">` : ''}
                ${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
                ${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
                ${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
                ${site ? `<meta property="og:site_name" content="${esc(site)}">` : ''}
                ${author ? `<meta name="author" content="${esc(author)}">` : ''}
                <meta property="og:url" content="${esc(md.sourceURL || targetUrl)}">
                <base href="${esc(md.sourceURL || targetUrl)}">
              </head><body>${fcHtml}</body></html>`;
              if (title || image || fcHtml) {
                okResp = new Response(synth, { status: 200, headers: { 'Content-Type': 'text/html' } });
                resolvedUrl = md.sourceURL || targetUrl;
                console.log('[unfurl-article] Success with Firecrawl. title:', title?.slice(0,80), 'image:', !!image);
              }
            } else {
              console.log('[unfurl-article] Firecrawl failed:', fc.status);
            }
          } catch (e) {
            console.log('[unfurl-article] Firecrawl error:', e instanceof Error ? e.message : String(e));
          }
        }
      }

      if (!okResp) {
        console.log('[unfurl-article] All fetch strategies failed');
        throw new Error('HTTP error! All fetch strategies failed');
      }

      html = await okResp.text();
      // Never let a proxy origin (r.jina.ai) become the resolved article URL —
      // it would poison the site name, domain and favicon shown on the card.
      if (!usedProxy) {
        const candidate = okResp.url || resolvedUrl;
        try {
          if (!/(^|\.)r\.jina\.ai$/i.test(new URL(candidate).hostname)) resolvedUrl = candidate;
        } catch { /* keep existing resolvedUrl */ }
      }
    }

    // Extract metadata
    let title = extractTitle(html);
    // Proxy/reader output has no <title>; it prefixes a "Title: ..." line.
    if (!title) {
      const m = html.match(/^\s*Title:\s*(.+)$/m);
      if (m) title = m[1].trim();
    }
    // Last resort: humanise the URL slug so the card never renders title-less.
    if (!title) {
      try {
        const seg = new URL(resolvedUrl).pathname.split('/').filter(Boolean).pop() || '';
        const words = decodeURIComponent(seg).replace(/\.(html?|php|aspx)$/i, '').replace(/[-_]+/g, ' ').trim();
        if (words) title = words.replace(/\b\w/g, (c) => c.toUpperCase());
      } catch { /* ignore */ }
    }
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
    
    if (image) {
      // Make sure image URL is absolute
      if (!image.startsWith('http')) {
        image = new URL(image, resolvedUrl).href;
      }
      console.log('[unfurl-article] Extracted og:image:', image);
    } else {
      console.log('[unfurl-article] No og:image found, trying content image');
    }
    
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

    // Extract favicon - try multiple patterns
    let faviconHref: string | null = null;
    
    // Try multiple favicon patterns in order of preference
    const wantedRels = ['icon', 'shortcut icon', 'apple-touch-icon', 'apple-touch-icon-precomposed'];
    const linkRegex = /<link\b[^>]*>/gi;
    let lm: RegExpExecArray | null;
    const iconCandidates: { rel: string; href: string }[] = [];
    while ((lm = linkRegex.exec(html)) !== null) {
      const tag = lm[0];
      const relMatch = tag.match(/\srel\s*=\s*["']([^"']+)["']/i);
      const hrefMatch = tag.match(/\shref\s*=\s*["']([^"']+)["']/i);
      if (!relMatch || !hrefMatch) continue;
      const rel = relMatch[1].toLowerCase().trim();
      if (wantedRels.some((r) => rel.split(/\s+/).includes(r) || rel === r)) {
        iconCandidates.push({ rel, href: hrefMatch[1] });
      }
    }
    // Prefer "icon" over apple-touch-icon
    const preferred = iconCandidates.find((c) => c.rel.includes('icon') && !c.rel.includes('apple')) || iconCandidates[0];
    if (preferred) faviconHref = preferred.href;

    // Fallback to /favicon.ico if nothing found
    if (!faviconHref) faviconHref = '/favicon.ico';
    
    // Convert to absolute URL
    const favicon = faviconHref.startsWith('http') ? faviconHref : new URL(faviconHref, resolvedUrl).href;
    
    console.log('[unfurl-article] Extracted favicon:', favicon);

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

    console.log('[unfurl-article] Extracted data:', { 
      kind, 
      title: result.meta.title, 
      contentLength: articleHtml.length,
      hasContent: !!articleHtml,
      descriptionLength: description.length 
    });

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
