import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSRF Protection: Validate URLs to prevent internal network access
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.log('[fetch-og] Rejected non-HTTP protocol:', parsed.protocol);
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
      console.log('[fetch-og] Rejected blocked hostname:', hostname);
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
        console.log('[fetch-og] Rejected private IP:', hostname);
        return false;
      }
    }
    
    return true;
  } catch {
    console.log('[fetch-og] Failed to parse URL');
    return false;
  }
}

const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
};

function resolveUrl(maybeRelative: string, baseUrl: string): string | null {
  try { return new URL(maybeRelative, baseUrl).toString(); } catch { return null; }
}

function isLikelyRealContentImage(url: string): boolean {
  if (!url) return false;
  const u = url.trim();
  if (!u || u.startsWith('data:')) return false;
  if (/\.svg(\?|#|$)/i.test(u)) return false;
  const lower = u.toLowerCase();
  const blockedHints = ['sprite','icon','favicon','logo','avatar','profile-photo','blank.gif','spacer.gif','pixel.gif','1x1','tracking','analytics','badge','emoji'];
  if (blockedHints.some(h => lower.includes(h))) return false;
  if (/[?&=_/-](?:w|width)=(?:8|16|24|32|48|64)\b/i.test(u)) return false;
  if (/(^|[/_-])(?:16|24|32|48|64)x(?:16|24|32|48|64)([._/]|$)/i.test(u)) return false;
  return true;
}

function findFirstContentImage(html: string): string | null {
  const scopes: string[] = [];
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) scopes.push(articleMatch[0]);
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  if (mainMatch) scopes.push(mainMatch[0]);
  scopes.push(html);
  for (const scope of scopes) {
    const imgRegex = /<img[^>]+>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRegex.exec(scope)) !== null) {
      const tag = m[0];
      const src =
        tag.match(/\s(?:data-src|data-original|data-lazy-src|data-srcset|srcset)=["']([^"']+)["']/i)?.[1] ||
        tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
      if (!src) continue;
      const candidate = decodeHtmlEntities(src.split(',')[0].trim().split(/\s+/)[0]);
      if (isLikelyRealContentImage(candidate)) return candidate;
    }
  }
  return null;
}

function extractArticleMetadata(
  html: string,
  baseUrl: string
): { image: string | null; title: string | null; description: string | null } {
  const meta = (name: string): string | null => {
    const want = name.toLowerCase();
    const tagRegex = /<meta\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(html)) !== null) {
      const tag = m[0];
      const propMatch = tag.match(/\s(property|name|itemprop)\s*=\s*["']?([^"'\s>]+)["']?/i);
      if (!propMatch || propMatch[2].toLowerCase() !== want) continue;
      const contentMatch =
        tag.match(/\scontent\s*=\s*"([^"]*)"/i) ||
        tag.match(/\scontent\s*=\s*'([^']*)'/i) ||
        tag.match(/\scontent\s*=\s*([^\s>]+)/i);
      if (contentMatch?.[1]) return decodeHtmlEntities(contentMatch[1]).trim();
    }
    return null;
  };

  let jsonLdTitle: string | null = null;
  let jsonLdImage: string | null = null;
  let jsonLdDesc: string | null = null;
  const ldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    if (!inner) continue;
    try {
      const parsed = JSON.parse(inner);
      const nodes: any[] = Array.isArray(parsed) ? parsed : (parsed['@graph'] && Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]);
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const t = node.headline || node.name;
        const d = node.description;
        let img: any = node.image || node.thumbnailUrl || node.thumbnail;
        if (Array.isArray(img)) img = img[0];
        if (img && typeof img === 'object') img = img.url || img['@id'] || null;
        if (!jsonLdTitle && typeof t === 'string') jsonLdTitle = t.trim();
        if (!jsonLdDesc && typeof d === 'string') jsonLdDesc = d.trim();
        if (!jsonLdImage && typeof img === 'string') jsonLdImage = img.trim();
        if (jsonLdTitle && jsonLdImage) break;
      }
    } catch { /* ignore */ }
    if (jsonLdTitle && jsonLdImage) break;
  }

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const h1Tag = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  let title =
    meta('og:title') ||
    (titleTag ? decodeHtmlEntities(titleTag.trim()) : null) ||
    meta('twitter:title') ||
    jsonLdTitle ||
    (h1Tag ? decodeHtmlEntities(h1Tag.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : null);

  if (!title) {
    try {
      title = new URL(baseUrl).hostname.replace(/^www\./, '');
    } catch {
      title = null;
    }
  }

  const description =
    meta('og:description') || meta('twitter:description') || meta('description') || jsonLdDesc;

  let image =
    meta('og:image') || meta('og:image:secure_url') || meta('og:image:url') ||
    meta('twitter:image') || meta('twitter:image:src') ||
    jsonLdImage || findFirstContentImage(html);

  if (image) {
    image = resolveUrl(image, baseUrl);
    if (image && !isLikelyRealContentImage(image)) image = findFirstContentImage(html);
    if (image) image = resolveUrl(image, baseUrl);
  }

  return { image: image || null, title: title || null, description: description || null };
}

const stripHtml = (text: string): string =>
  decodeHtmlEntities(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

const extractXmlTag = (xml: string, tag: string): string | null => {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cdata = xml.match(new RegExp(`<${escaped}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escaped}>`, 'i'));
  if (cdata?.[1]) return decodeHtmlEntities(cdata[1].trim());
  const plain = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return plain?.[1] ? decodeHtmlEntities(plain[1].trim()) : null;
};

const getMediumFeedUrl = (targetUrl: string): { feedUrl: string; postId: string | null; slug: string | null } | null => {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    const postId = parsed.pathname.match(/(?:-|\/p\/)([a-f0-9]{10,})(?:[/?#]|$)/i)?.[1] || null;
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const slug = lastSegment.replace(/-[a-f0-9]{10,}$/i, '').toLowerCase() || null;

    if (host === 'medium.com' || host === 'www.medium.com') {
      const author = parsed.pathname.match(/^\/@([^/]+)/)?.[1];
      return author ? { feedUrl: `https://medium.com/feed/@${author}`, postId, slug } : null;
    }

    if (host.endsWith('.medium.com')) {
      return { feedUrl: `https://${host}/feed`, postId, slug };
    }
  } catch {
    return null;
  }
  return null;
};

async function fetchMediumRssPreview(targetUrl: string): Promise<{ title: string; image: string | null; description: string | null; finalUrl: string } | null> {
  const info = getMediumFeedUrl(targetUrl);
  if (!info) return null;

  try {
    const res = await fetch(info.feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/rss+xml,text/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;

    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const item = items.find((entry) => {
      const link = extractXmlTag(entry, 'link') || '';
      const guid = extractXmlTag(entry, 'guid') || '';
      const haystack = `${link} ${guid} ${entry}`.toLowerCase();
      return (!!info.postId && haystack.includes(info.postId.toLowerCase())) || (!!info.slug && haystack.includes(info.slug));
    });
    if (!item) return null;

    const title = extractXmlTag(item, 'title');
    const link = extractXmlTag(item, 'link') || targetUrl;
    const content = extractXmlTag(item, 'content:encoded') || extractXmlTag(item, 'description') || '';
    const subtitle = content.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
    const firstParagraph = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    const image = content.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || null;

    if (!title) return null;
    return {
      title: stripHtml(title),
      image: image ? decodeHtmlEntities(image) : null,
      description: subtitle ? stripHtml(subtitle) : (firstParagraph ? stripHtml(firstParagraph) : null),
      finalUrl: link,
    };
  } catch (error) {
    console.log('[fetch-og] Medium RSS failed:', error);
    return null;
  }
}

async function resolveRedditCanonicalUrl(targetUrl: string): Promise<string> {
  try {
    const parsed = new URL(targetUrl);
    const isShortShare = /^www\.reddit\.com$/i.test(parsed.hostname) && /^\/r\/[^/]+\/s\/[^/]+\/?$/i.test(parsed.pathname);
    if (!isShortShare) return targetUrl;
    const res = await fetch(`https://reddit.com${parsed.pathname}${parsed.search}`, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
    });
    const location = res.headers.get('location');
    return location && /\/comments\//i.test(location) ? location : targetUrl;
  } catch {
    return targetUrl;
  }
}

async function fetchRedditOembed(targetUrl: string): Promise<{ title: string | null; description: string | null } | null> {
  try {
    const res = await fetch(`https://www.reddit.com/oembed?url=${encodeURIComponent(targetUrl)}`, {
      headers: { 'User-Agent': 'Aelixto/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: typeof data.title === 'string' ? decodeHtmlEntities(data.title) : null,
      description: typeof data.author_name === 'string' ? `Posted by u/${data.author_name}` : 'View on Reddit',
    };
  } catch {
    return null;
  }
}

function extractFacebookNextUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return null;
    const next = parsed.searchParams.get('next');
    if (!next) return null;
    const nextUrl = new URL(decodeURIComponent(next));
    if (!/(^|\.)facebook\.com$/i.test(nextUrl.hostname)) return null;
    // rdid breaks Facebook's public plugin for story.php image posts.
    nextUrl.searchParams.delete('rdid');
    const looksLikePost =
      /\/story\.php/i.test(nextUrl.pathname) ||
      /\/permalink\.php/i.test(nextUrl.pathname) ||
      /\/(?:photo|photos|posts|videos?|watch|reel)\b/i.test(nextUrl.pathname) ||
      nextUrl.searchParams.has('story_fbid') ||
      nextUrl.searchParams.has('fbid') ||
      nextUrl.searchParams.has('v');
    return looksLikePost ? nextUrl.toString() : null;
  } catch {
    return null;
  }
}

function cleanFacebookCaption(text: string | null | undefined): string | null {
  if (!text) return null;
  let cleaned = stripFacebookBootstrapTail(decodeHtmlEntities(text))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/(?:^|\s)(?:See more|See Translation|See translation)(?:\s|$)/gi, ' ')
    .trim();
  cleaned = cleaned.replace(/^Facebook\s*[-–—:]?\s*/i, '').trim();
  const lower = cleaned.toLowerCase();
  if (
    !cleaned ||
    lower === 'facebook' ||
    lower.includes('log in to facebook') ||
    lower.includes('see posts, photos and more on facebook') ||
    isPageBootstrapDump(cleaned)
  ) return null;
  return cleaned.slice(0, 4000);
}

function stripFacebookBootstrapTail(value: string): string {
  const markers = [
    'function envFlush',
    'ServerJSQueue.add',
    'requireLazy',
    'Bootloader',
    'DTSGInitialData',
    'window.Env',
    'ajaxpipe_token',
    'enableBootload',
    'bumpVultureJSHash',
    'AsyncRequest',
    'IntlQtEventFalcoEvent',
  ];
  let earliest = -1;
  for (const marker of markers) {
    const idx = value.indexOf(marker);
    if (idx >= 0 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest >= 0 ? value.slice(0, earliest).trim() : value;
}

function isPageBootstrapDump(value: string): boolean {
  const stripped = stripFacebookBootstrapTail(value).trim();
  if (stripped && stripped !== value.trim()) return false;
  const text = value.slice(0, 4000);
  const markers = [
    'requireLazy',
    'Bootloader',
    'ServerJSQueue',
    'envFlush',
    'ajaxpipe_token',
    'enableBootload',
    'window.Env',
    'bumpVultureJSHash',
    'AsyncRequest',
    'IntlQtEventFalcoEvent',
    'DTSGInitialData',
  ];
  if (markers.some((marker) => text.includes(marker))) return true;
  if (text.length > 120) {
    const codey = (text.match(/[{}\[\]"`]/g) || []).length;
    if (codey / text.length > 0.18) return true;
  }
  return false;
}

function extractFacebookPluginCaption(html: string): string | null {
  const candidates: string[] = [];
  const markerRegex = /data-testid=["']post_message["']/gi;
  let marker: RegExpExecArray | null;
  while ((marker = markerRegex.exec(html)) !== null) {
    const start = html.lastIndexOf('<', marker.index);
    const chunkStart = start >= 0 ? start : marker.index;
    const nextMessage = html.indexOf('data-testid="post_message"', marker.index + 1);
    const footerOffset = html.slice(marker.index).search(/(?:data-testid=["']UFI2CommentsCount["']|<form\b|aria-label=["']Like["'])/i);
    const nextFooter = footerOffset >= 0 ? marker.index + footerOffset : -1;
    const hardEnd = nextMessage > marker.index ? nextMessage : -1;
    const softEnd = nextFooter > marker.index ? nextFooter : -1;
    const end = [hardEnd, softEnd, chunkStart + 8000].filter((n) => n > chunkStart).sort((a, b) => a - b)[0] || chunkStart + 8000;
    candidates.push(html.slice(chunkStart, Math.min(html.length, end)));
  }

  const legacy = html.match(/<(?:div|span)[^>]+(?:userContent|post-message|post_message)[^>]*>([\s\S]*?)<\/(?:div|span)>/i)?.[0];
  if (legacy) candidates.push(legacy);

  for (const candidate of candidates) {
    const cleaned = cleanFacebookCaption(stripHtml(candidate));
    if (cleaned) return cleaned;
  }
  return null;
}

function readAttrNumber(tag: string, attr: string): number | null {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = tag.match(new RegExp(`\\s${escaped}=["']?(\\d+)`, 'i'))?.[1];
  const num = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(num) && num > 0 ? num : null;
}

function isFacebookPlaceholderImage(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('/images/login/qrcodeloginpizza') || lower.includes('static.xx.fbcdn.net') || lower.includes('/rsrc.php/');
}

function extractFacebookPluginImage(html: string, baseUrl: string): string | null {
  const images: Array<{ url: string; score: number }> = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const raw =
      tag.match(/\s(?:data-src|src)=['"]([^'"]+)['"]/i)?.[1] ||
      tag.match(/\s(?:data-src|src)=([^\s>]+)/i)?.[1];
    if (!raw) continue;
    const resolved = resolveUrl(decodeHtmlEntities(raw).replace(/\\\//g, '/'), baseUrl);
    if (!resolved) continue;
    const lower = resolved.toLowerCase();
    if ((!/(scontent|fbcdn)\./i.test(lower) && !lower.includes('scontent-')) || isFacebookPlaceholderImage(resolved)) continue;
    if (!isLikelyRealContentImage(resolved)) continue;

    const width = readAttrNumber(tag, 'width');
    const height = readAttrNumber(tag, 'height');
    const area = width && height ? width * height : 0;
    let score = area;
    if (/\/v\/t(?:39|45|51|15|1\.)/i.test(lower)) score += 10000;
    if (lower.includes('_n.jpg') || lower.includes('_n.png') || lower.includes('_n.webp')) score += 5000;
    if (lower.includes('p100x100') || lower.includes('s100x100') || lower.includes('cp0_dst')) score -= 20000;
    images.push({ url: resolved, score });
  }
  images.sort((a, b) => b.score - a.score);
  return images[0]?.url || null;
}

async function scrapeFacebookPlugin(url: string, fallbackUrl?: string): Promise<{ title: string | null; image: string | null; description: string | null; finalUrl: string }> {
  const hrefs = [...new Set(([url, fallbackUrl].filter(Boolean) as string[]).flatMap(getFacebookPluginHrefs))];
  const endpoints = hrefs.flatMap((href) => [
    `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(href)}&show_text=true&width=500`,
    `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=true&width=500`,
  ]);

  for (const pluginUrl of endpoints) {
    try {
      const response = await fetch(pluginUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!response.ok) continue;
      const html = await response.text();
      const meta = extractArticleMetadata(html, pluginUrl);
      const caption = extractFacebookPluginCaption(html) || cleanFacebookCaption(meta.description);
      const image = extractFacebookPluginImage(html, pluginUrl) || (meta.image && !isFacebookPlaceholderImage(meta.image) ? meta.image : null);
      const title = cleanFacebookCaption(meta.title);
      if (caption || image || title) {
        return { title, image, description: caption, finalUrl: url };
      }
    } catch (error) {
      console.log('[fetch-og] Facebook plugin scrape failed:', error instanceof Error ? error.message : String(error));
    }
  }

  return { title: null, image: null, description: null, finalUrl: url };
}

function normalizeFacebookPluginHref(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (/(^|\.)facebook\.com$/i.test(parsed.hostname)) {
      parsed.searchParams.delete('rdid');
      parsed.searchParams.delete('mibextid');
      parsed.searchParams.delete('__cft__');
      parsed.searchParams.delete('__tn__');
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function getFacebookPluginHrefs(raw: string): string[] {
  const normalized = normalizeFacebookPluginHref(raw);
  const candidates = [normalized];
  try {
    const parsed = new URL(normalized);
    if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return candidates;

    let storyId = parsed.searchParams.get('story_fbid') || parsed.searchParams.get('fbid');
    let pageId = parsed.searchParams.get('id');
    const postId = parsed.searchParams.get('post_id');
    if (postId?.includes('_')) {
      const [postPageId, postStoryId] = postId.split('_');
      pageId = pageId || postPageId;
      storyId = storyId || postStoryId;
    }
    const pathPost = parsed.pathname.match(/^\/(\d+)\/posts\/(\d+)/i);
    if (pathPost) {
      pageId = pageId || pathPost[1];
      storyId = storyId || pathPost[2];
    }

    if (storyId && pageId) {
      candidates.push(`https://www.facebook.com/story.php?story_fbid=${encodeURIComponent(storyId)}&id=${encodeURIComponent(pageId)}`);
      candidates.push(`https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(storyId)}&id=${encodeURIComponent(pageId)}`);
      candidates.push(`https://www.facebook.com/${encodeURIComponent(pageId)}/posts/${encodeURIComponent(storyId)}`);
    }
  } catch {
    // keep normalized URL only
  }
  return candidates;
}

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

    // SSRF Protection: Validate URL before fetching
    if (!isValidExternalUrl(targetUrl)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or blocked URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fetch-og] Fetching OG data for:', targetUrl);

    const urlLower = targetUrl.toLowerCase();
    
    // Try oEmbed/RSS APIs first for specific platforms (more reliable)
    if (urlLower.includes('medium.com')) {
      const mediumData = await fetchMediumRssPreview(targetUrl);
      if (mediumData) {
        console.log('[fetch-og] Medium RSS success:', mediumData.title);
        return new Response(
          JSON.stringify({ ...mediumData, og_type: 'article' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

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

    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
      let facebookUrl = targetUrl;
      if (urlLower.includes('/share/') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
        try {
          const expanded = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)' },
          });
          facebookUrl = extractFacebookNextUrl(expanded.url) || expanded.url || targetUrl;
        } catch (e) {
          console.log('[fetch-og] Facebook expansion failed:', e instanceof Error ? e.message : String(e));
        }
      }

      const pluginData = await scrapeFacebookPlugin(facebookUrl, targetUrl);
      if (pluginData.title || pluginData.image || pluginData.description) {
        console.log('[fetch-og] Facebook plugin success:', {
          title: pluginData.title?.slice(0, 80),
          hasImage: !!pluginData.image,
          hasDescription: !!pluginData.description,
        });
        return new Response(
          JSON.stringify({ ...pluginData, og_type: 'facebook' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
      const redditUrl = await resolveRedditCanonicalUrl(targetUrl);
      const redditOembed = await fetchRedditOembed(redditUrl);
      // Use Reddit's public JSON API - append .json to the post URL.
      // Only handle proper post URLs (reddit.com/r/*/comments/*).
      try {
        let jsonUrl = redditUrl.split('?')[0].split('#')[0];
        const isPostUrl = /reddit\.com\/r\/[^/]+\/comments\/[^/]+/i.test(jsonUrl);
        if (!isPostUrl) {
          throw new Error('Not a Reddit post URL, skipping JSON API');
        }
        if (jsonUrl.endsWith('/')) jsonUrl = jsonUrl.slice(0, -1);
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
            // Prefer the post's thumbnail field; fall back to a real media URL.
            // Reject sentinel values ("self", "nsfw", "default", "spoiler", "image").
            const invalidThumbs = new Set(['self', 'nsfw', 'default', 'spoiler', 'image', '']);
            let thumbnail: string | null = null;
            const rawThumb = typeof post.thumbnail === 'string' ? post.thumbnail.trim() : '';
            if (rawThumb && !invalidThumbs.has(rawThumb.toLowerCase()) && /^https?:\/\//i.test(rawThumb)) {
              thumbnail = rawThumb.replace(/&amp;/g, '&');
            } else if (post.url_overridden_by_dest && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(post.url_overridden_by_dest)) {
              thumbnail = post.url_overridden_by_dest;
            } else if (typeof post.url === 'string' && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(post.url)) {
              thumbnail = post.url;
            } else if (post.preview?.images?.[0]?.source?.url) {
              thumbnail = post.preview.images[0].source.url.replace(/&amp;/g, '&');
            } else if (post.gallery_data?.items?.[0]?.media_id && post.media_metadata?.[post.gallery_data.items[0].media_id]?.s?.u) {
              thumbnail = post.media_metadata[post.gallery_data.items[0].media_id].s.u.replace(/&amp;/g, '&');
            } else if (post.secure_media?.oembed?.thumbnail_url || post.media?.oembed?.thumbnail_url) {
              thumbnail = post.secure_media?.oembed?.thumbnail_url || post.media?.oembed?.thumbnail_url;
            }
            
            console.log('[fetch-og] Reddit JSON API success:', thumbnail?.substring(0, 60) || 'no image');
            // Prefer the actual post body (selftext) so creators get the
            // original caption auto-filled. Fall back to author/byline.
            const selftext = typeof post.selftext === 'string' ? post.selftext.trim() : '';
            const captionText = selftext.length > 0
              ? selftext.slice(0, 2000)
              : (post.author ? `Posted by u/${post.author}` : (redditOembed?.description || 'View on Reddit'));
            return new Response(
              JSON.stringify({ 
                title: post.title || redditOembed?.title || 'Reddit Post', 
                image: thumbnail, 
                description: captionText,
                finalUrl: redditUrl 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (e) {
        console.log('[fetch-og] Reddit JSON API failed, falling back to HTML:', e);
      }

      if (redditOembed?.title) {
        return new Response(
          JSON.stringify({
            title: redditOembed.title,
            image: null,
            description: redditOembed.description || 'View on Reddit',
            finalUrl: redditUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
                title: tweet.user?.name ? `@${tweet.user.screen_name}` : 'X', 
                image: thumbnail, 
                description: tweet.text?.substring(0, 4000) || '',
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

    const fallbackUAs = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ];

    let response: Response | null = null;
    for (const ua of fallbackUAs) {
      try {
        const r = await fetch(targetUrl, { headers: buildHeaders(ua), redirect: 'follow' });
        if (r.ok) { response = r; console.log('[fetch-og] Success with UA:', ua); break; }
        console.log('[fetch-og] UA failed:', ua, r.status);
        response = r;
      } catch (e) {
        console.log('[fetch-og] UA error:', ua, e instanceof Error ? e.message : String(e));
      }
    }

    // Last-resort: r.jina.ai proxy (returns markdown but contains title/image refs)
    if (!response || !response.ok) {
      try {
        const jina = await fetch(`https://r.jina.ai/${targetUrl}`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,*/*' },
          redirect: 'follow',
        });
        if (jina.ok) { response = jina; console.log('[fetch-og] Success with r.jina.ai proxy'); }
      } catch (e) {
        console.log('[fetch-og] Jina proxy failed:', e instanceof Error ? e.message : String(e));
      }
    }

    // Final fallback: Firecrawl (bypasses Cloudflare / anti-bot challenges)
    if (!response || !response.ok) {
      const fcKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (fcKey) {
        try {
          console.log('[fetch-og] Trying Firecrawl fallback');
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
            const title = md.ogTitle || md.title || '';
            const desc = md.ogDescription || md.description || '';
            const image = md.ogImage || md['og:image'] || md.image || '';
            const ogType = md.ogType || md['og:type'] || null;
            const finalUrl = md.sourceURL || md.url || targetUrl;
            if (title || image) {
              console.log('[fetch-og] Firecrawl direct return. title:', title?.slice(0,80), 'image:', image?.slice(0,120));
              return new Response(
                JSON.stringify({ title: title || null, image: image || null, description: desc || null, finalUrl, og_type: ogType }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            console.log('[fetch-og] Firecrawl failed:', fc.status);
          }
        } catch (e) {
          console.log('[fetch-og] Firecrawl error:', e instanceof Error ? e.message : String(e));
        }
      }
    }

    if (!response) {
      response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      redirect: 'follow',
    });
    }

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
        } else if (urlLower.includes('reddit.com') || urlLower.includes('redd.it')) {
          platformName = 'Reddit';
          placeholderImage = '';
        } else if (urlLower.includes('medium.com')) {
          platformName = 'Medium';
          placeholderImage = '';
        }
        
        return new Response(
          JSON.stringify({ 
            title: `${platformName} Post`,
            image: placeholderImage || null,
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

    const extractMeta = (propName: string): string | null => {
      const want = propName.toLowerCase();
      const tagRegex = /<meta\b[^>]*>/gi;
      let m: RegExpExecArray | null;
      while ((m = tagRegex.exec(html)) !== null) {
        const tag = m[0];
        const propMatch = tag.match(/\s(property|name|itemprop)\s*=\s*["']?([^"'\s>]+)["']?/i);
        if (!propMatch || propMatch[2].toLowerCase() !== want) continue;
        const contentMatch =
          tag.match(/\scontent\s*=\s*"([^"]*)"/i) ||
          tag.match(/\scontent\s*=\s*'([^']*)'/i) ||
          tag.match(/\scontent\s*=\s*([^\s>]+)/i);
        if (contentMatch?.[1]) return decodeHtmlEntities(contentMatch[1]).trim();
      }
      return null;
    };

    // Use the universal article metadata extractor so titles/images work
    // across any website (Open Graph → Twitter → JSON-LD → <h1> → first
    // real <img> inside <article>/<main>).
    const meta = extractArticleMetadata(html, finalUrl);
    const title = meta.title;
    const image = meta.image;
    const description = meta.description;
    const ogType = extractMeta('og:type');

    console.log('[fetch-og] Extracted OG data:', { title, image, description, ogType, finalUrl });

    return new Response(
      JSON.stringify({ title, image, description, finalUrl, og_type: ogType }),
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
