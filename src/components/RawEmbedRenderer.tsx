import { useEffect, useRef, useState } from 'react';
import { loadInstagramEmbed, loadFacebookSDK, loadThreadsEmbed, clearScriptCache } from '@/lib/ScriptLoader';
import DOMPurify from 'dompurify';

/** Decode HTML entities (&#064; → @, &#039; → ', etc.) using DOMParser */
const decodeHtmlEntities = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || html;
  } catch {
    return html;
  }
};

const fullyDecodeHtmlEntities = (value: string): string => {
  let decoded = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = decodeHtmlEntities(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
};

const isFacebookVideoUrl = (value: string): boolean => {
  const normalized = fullyDecodeHtmlEntities(value).toLowerCase();
  return (
    normalized.includes('/reel/') ||
    normalized.includes('/videos/') ||
    normalized.includes('/watch/') ||
    normalized.includes('fb.watch')
  );
};

const unwrapFacebookLoginRedirect = (value: string): string => {
  let current = fullyDecodeHtmlEntities(value).trim();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextIndex = current.search(/[?&]next=/i);
    if (nextIndex >= 0) {
      const nextValue = current.slice(nextIndex).replace(/^[?&]next=/i, '').trim();
      if (nextValue.startsWith('http://') || nextValue.startsWith('https://')) {
        current = fullyDecodeHtmlEntities(nextValue);
        continue;
      }
    }

    try {
      const parsed = new URL(current);
      const hostname = parsed.hostname.toLowerCase();
      const isFacebookLogin =
        (hostname === 'facebook.com' || hostname === 'www.facebook.com' || hostname.endsWith('.facebook.com')) &&
        parsed.pathname.startsWith('/login');
      const nextUrl = parsed.searchParams.get('next');

      if (!isFacebookLogin || !nextUrl) break;
      current = fullyDecodeHtmlEntities(nextUrl).trim();
    } catch {
      break;
    }
  }

  return current;
};

const setStyleDeclaration = (style: string, property: string, value: string): string => {
  const withoutProperty = style.replace(new RegExp(`${property}\\s*:\\s*[^;]+;?`, 'gi'), '').trim();
  const normalizedBase = withoutProperty
    ? `${withoutProperty}${withoutProperty.endsWith(';') ? '' : ';'}`
    : '';

  return `${normalizedBase}${property}:${value};`;
};

const normalizeFacebookIframeEmbed = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const iframe = doc.querySelector('iframe[src*="facebook.com/plugins/"]');
    if (!iframe) return html;

    const iframeSrc = fullyDecodeHtmlEntities(iframe.getAttribute('src') || '');
    const pluginPath = iframeSrc.toLowerCase();

    let targetUrl = iframeSrc;
    try {
      const iframeUrl = new URL(iframeSrc);
      targetUrl = fullyDecodeHtmlEntities(iframeUrl.searchParams.get('href') || iframeSrc);
    } catch {
      targetUrl = iframeSrc;
    }

    const aspectRatio =
      pluginPath.includes('/video.php') || isFacebookVideoUrl(targetUrl) ? '9/16' : '4/5';
    const baseStyle = iframe.getAttribute('style') || 'border:none;width:100%;overflow:hidden;';
    iframe.setAttribute('style', setStyleDeclaration(baseStyle, 'aspect-ratio', aspectRatio));

    return doc.body.innerHTML;
  } catch {
    return html;
  }
};

/**
 * Decode HTML entities inside blockquote text nodes so raw codes like &#064;
 * don't flash before the Threads SDK replaces them with an iframe.
 * Only touches text content — leaves HTML structure/tags intact.
 */
const decodeBlockquoteEntities = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      node.textContent = fullyDecodeHtmlEntities(node.textContent ?? '');
    }
    return doc.body.innerHTML;
  } catch {
    return html;
  }
};

interface RawEmbedRendererProps {
  embedHtml: string;
  onError?: () => void;
  onOriginalVisit?: () => void;
}

// Sanitize embed HTML using DOMPurify to prevent XSS attacks
// Strip Instagram caption attribute to render media-only embeds
const stripInstagramCaption = (html: string): string => {
  // Remove data-instgrm-captioned attribute so embed renders without native caption
  return html.replace(/\s*data-instgrm-captioned\s*/gi, ' ');
};

const sanitizeEmbedHtml = (html: string): string => {
  // First strip Instagram caption attribute
  let processedHtml = stripInstagramCaption(html);
  
  return DOMPurify.sanitize(processedHtml, {
    ALLOWED_TAGS: ['blockquote', 'div', 'iframe', 'a', 'p', 'br', 'span', 'img', 'svg', 'path', 'title', 'section'],
    ALLOWED_ATTR: ['class', 'data-href', 'data-width', 'data-show-text', 'data-instgrm-permalink', 'data-instgrm-version', 'href', 'src', 'style', 'target', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'loading', 'alt', 'allowtransparency', 'scrolling', 'data-text-post-permalink', 'data-text-post-version', 'id', 'viewBox', 'xmlns', 'role', 'fill', 'd', 'aria-label', 'cite', 'data-video-id', 'rel'],
    ALLOW_DATA_ATTR: true
  });
};

// Convert Facebook iframe embed to SDK-compatible format
const transformFacebookEmbed = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sdkEmbed = doc.querySelector<HTMLElement>('.fb-post, .fb-video');

    if (sdkEmbed) {
      const rawHref = sdkEmbed.getAttribute('data-href');
      if (rawHref) {
        sdkEmbed.setAttribute('data-href', unwrapFacebookLoginRedirect(rawHref));
      }
      if (!sdkEmbed.getAttribute('data-width')) {
        sdkEmbed.setAttribute('data-width', 'auto');
      }
      // Render Facebook embeds without native caption text
      sdkEmbed.setAttribute('data-show-text', 'false');
      return doc.body.innerHTML;
    }

    const iframe = doc.querySelector<HTMLIFrameElement>('iframe[src*="facebook.com/plugins/"]');
    if (iframe) {
      const iframeSrc = fullyDecodeHtmlEntities(iframe.getAttribute('src') || '');
      const iframeUrl = new URL(iframeSrc);
      const rawHref = iframeUrl.searchParams.get('href');

      if (rawHref) {
        const postUrl = unwrapFacebookLoginRedirect(rawHref);
        const embedDiv = doc.createElement('div');
        embedDiv.className =
          isFacebookVideoUrl(postUrl) || iframeUrl.pathname.toLowerCase().includes('/video.php')
            ? 'fb-video'
            : 'fb-post';
        embedDiv.setAttribute('data-href', postUrl);
        embedDiv.setAttribute('data-width', 'auto');
        embedDiv.setAttribute('data-show-text', 'false');
        return embedDiv.outerHTML;
      }
    }
  } catch {
    return html;
  }

  return html;
};

// Detect if content is Instagram (for rendering decisions like viewport-lock)
const isInstagramEmbed = (html: string): boolean => {
  return html.includes('instagram.com') || html.includes('instagram-media');
};

// Detect platform for SDK processing purposes
const detectPlatform = (html: string): 'instagram' | 'facebook' | 'threads' | 'tiktok' | 'unknown' => {
  // Instagram iframes don't need SDK processing
  if (html.includes('instagram.com') && html.includes('<iframe')) {
    return 'unknown';
  }
  if (html.includes('instagram.com') || html.includes('instagram-media')) {
    return 'instagram';
  }
  // Facebook — SDK handles both blockquotes and fb-post/fb-video divs
  if (html.includes('facebook.com') || html.includes('fb-post') || html.includes('fb-video')) {
    return 'facebook';
  }
  // Threads iframes don't need SDK processing
  if ((html.includes('threads.net') && html.includes('<iframe'))) {
    return 'unknown';
  }
  if (html.includes('text-post-media') || html.includes('threads.net')) {
    return 'threads';
  }
  // TikTok blockquote embeds need SDK
  if (html.includes('tiktok-embed') || html.includes('tiktok.com/embed')) {
    return 'tiktok';
  }
  return 'unknown';
};

export const RawEmbedRenderer = ({ embedHtml, onError, onOriginalVisit }: RawEmbedRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const hasProcessedRef = useRef(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const platform = detectPlatform(embedHtml);
  const isInstagram = isInstagramEmbed(embedHtml);
  let sanitizedHtml = sanitizeEmbedHtml(embedHtml);
  
  // Transform Facebook embeds to SDK-compatible format
  if (platform === 'facebook') {
    sanitizedHtml = transformFacebookEmbed(sanitizedHtml);
  }


  // Extract URL from embed HTML for double-tap redirection
  const getEmbedUrl = () => {
    if (platform === 'instagram') {
      const match = embedHtml.match(/https:\/\/www\.instagram\.com\/[^\s"]+/);
      return match?.[0] || null;
    }
    if (platform === 'facebook') {
      const match = embedHtml.match(/data-href="([^"]+)"/);
      return match?.[1] || null;
    }
    return null;
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      const url = getEmbedUrl();
      if (url) {
        onOriginalVisit?.();
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
    
    lastTapRef.current = now;
  };

  // MutationObserver: watch for iframe creation and lock its scrolling immediately
  useEffect(() => {
    if (!isInstagram || !containerRef.current) return;

    const lockIframe = (iframe: HTMLIFrameElement) => {
      iframe.setAttribute('scrolling', 'no');
      iframe.style.overflow = 'hidden';
      // Wrap iframe's container to prevent touch-scroll
      const parent = iframe.parentElement;
      if (parent) {
        parent.style.overflow = 'hidden';
        parent.style.touchAction = 'pan-y';
      }
    };

    // Lock any existing iframes
    containerRef.current.querySelectorAll('iframe').forEach(lockIframe);

    // Watch for new iframes (SDK creates them asynchronously)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLIFrameElement) {
            lockIframe(node);
          }
          // Also check children of added nodes
          if (node instanceof HTMLElement) {
            node.querySelectorAll('iframe').forEach(lockIframe);
          }
        }
      }
    });

    observer.observe(containerRef.current, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isInstagram]);

  useEffect(() => {
    const processEmbed = async () => {
      if (!containerRef.current) return;

      try {
        if (platform === 'instagram') {
          // Only call process() once per embed instance — skip on re-render / viewport re-entry
          if (hasProcessedRef.current) return;
          hasProcessedRef.current = true;

          await loadInstagramEmbed();
          
          // Process immediately if ready
          if (window.instgrm?.Embeds?.process) {
            window.instgrm.Embeds.process();
            
            // Check if embed rendered successfully after a longer delay
            setTimeout(() => {
              if (containerRef.current) {
                const hasIframe = containerRef.current.querySelector('iframe');
                if (!hasIframe) {
                  // Retry once more before giving up
                  if (window.instgrm?.Embeds?.process) {
                    window.instgrm.Embeds.process();
                  }
                  setTimeout(() => {
                    if (containerRef.current && !containerRef.current.querySelector('iframe')) {
                      hasProcessedRef.current = false;
                      setEmbedFailed(true);
                      onError?.();
                    }
                  }, 3000);
                }
              }
            }, 4000);
          }
        } else if (platform === 'facebook') {
          // Only call parse() once per embed instance — skip on re-render / viewport re-entry
          if (hasProcessedRef.current) return;
          hasProcessedRef.current = true;

          await loadFacebookSDK();
          
          // Parse immediately
          if (window.FB?.XFBML?.parse) {
            window.FB.XFBML.parse(containerRef.current);
            
            // Check for errors after render - two passes
            const checkFacebookError = (timeout: number) => {
              setTimeout(() => {
                if (containerRef.current) {
                  const text = (containerRef.current.textContent || '').toLowerCase();
                  const iframe = containerRef.current.querySelector('iframe');
                  
                  const hasError = 
                    text.includes('no longer available') ||
                    text.includes('been removed') ||
                    text.includes('privacy setting') ||
                    text.includes("isn't available") ||
                    text.includes('log in to facebook') ||
                    !iframe; // No iframe = SDK failed to render
                  
                  if (hasError) {
                    setEmbedFailed(true);
                    onError?.();
                  }
                }
              }, timeout);
            };
            
            // First check at 3s, final check at 6s
            checkFacebookError(3000);
            checkFacebookError(6000);
          }
      } else if (platform === 'threads') {
          await loadThreadsEmbed();
          
          // Threads SDK auto-processes blockquotes on first load but has
          // no public process() API for re-processing in SPAs.
          // If the script was already cached, new blockquotes won't render.
          const retryThreads = (attempt: number) => {
            if (!containerRef.current || attempt > 2) return;
            if (containerRef.current.querySelector('iframe')) return;
            
            // Remove old script, clear cache, re-inject with cache-bust
            document.querySelectorAll('script[src*="threads.net/embed"]').forEach(s => s.remove());
            clearScriptCache('https://www.threads.net/embed.js');
            
            const script = document.createElement('script');
            script.src = `https://www.threads.net/embed.js?t=${Date.now()}`;
            script.async = true;
            document.body.appendChild(script);
          };
          
          setTimeout(() => retryThreads(0), 2000);
          setTimeout(() => retryThreads(1), 5000);
          setTimeout(() => retryThreads(2), 8000);
          
          // Final check: if no iframe after all retries, trigger error fallback
          setTimeout(() => {
            if (containerRef.current && !containerRef.current.querySelector('iframe')) {
              console.warn('[RawEmbedRenderer] Threads embed failed after all retries');
              setEmbedFailed(true);
              onError?.();
            }
          }, 11000);
        }
      } catch (error) {
        console.error('[RawEmbedRenderer] Failed to load embed script:', error);
        setEmbedFailed(true);
        onError?.();
      }
    };

    processEmbed();
  }, [embedHtml, platform, onError]);

  if (embedFailed) {
    return null;
  }

  // Instagram embeds get viewport-lock surgery to mask native action buttons/comments
  // The SDK replaces the blockquote with an iframe. We clip the bottom portion
  // (likes, comments, "Add a comment") using a height-constrained overflow-hidden container.
  if (isInstagram) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '3 / 5', touchAction: 'pan-y' }}
      >
        <div
          ref={containerRef}
          onClick={handleDoubleTap}
          className="embed-container w-full max-w-full [&>*]:!m-0"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 'calc(100% + 500px)',
            overflow: 'hidden',
          }}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
    );
  }


  // Threads embeds: tighter container, hide fallback link only when iframe loads
  // Height-contained wrapper clips extra vertical space injected by Threads SDK
  if (platform === 'threads') {
    // Decode HTML entities in blockquote text so raw codes like &#064; don't
    // flash before the Threads SDK replaces the blockquote with an iframe.
    const decodedThreadsHtml = decodeBlockquoteEntities(sanitizedHtml);

    return (
      <div
        style={{ width: '100%', maxHeight: 520, overflow: 'hidden', position: 'relative' }}
      >
        <div
          ref={containerRef}
          className="embed-container w-full max-w-full [&>*]:!m-0 [&>blockquote]:!mb-0 [&>blockquote]:!pb-0 [&>iframe]:!block [&>div]:!mb-0 [&>iframe~*]:!hidden"
          style={{ overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: decodedThreadsHtml }}
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onClick={handleDoubleTap}
      className="embed-container w-full max-w-full [&>*]:!m-0 [&_.fb-post]:!max-w-full [&_.fb-video]:!max-w-full [&_span[style*='padding-bottom']]:!pb-0 cursor-pointer"
      style={{ overflow: 'hidden' }}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
    FB?: {
      XFBML?: {
        parse: (element?: HTMLElement) => void;
      };
    };
    __threadsRetryCount?: number;
  }
}
