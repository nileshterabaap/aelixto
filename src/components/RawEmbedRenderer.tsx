import { useEffect, useRef, useState } from 'react';
import { loadInstagramEmbed, loadFacebookSDK, loadThreadsEmbed, clearScriptCache } from '@/lib/ScriptLoader';
import DOMPurify from 'dompurify';

interface RawEmbedRendererProps {
  embedHtml: string;
  onError?: () => void;
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
  // If already in SDK format (fb-post, fb-video), check if it has proper attributes
  if (html.includes('fb-post') || html.includes('fb-video')) {
    // Ensure it has data-width="auto" for responsive sizing
    if (!html.includes('data-width')) {
      html = html.replace(/class="fb-(post|video)"/, 'class="fb-$1" data-width="auto"');
    }
    return html;
  }
  
  // Extract the Facebook post URL from iframe src
  const iframeSrcMatch = html.match(/src=["']([^"']*facebook\.com[^"']*)["']/);
  
  if (iframeSrcMatch) {
    const iframeSrc = iframeSrcMatch[1];
    // Extract the href parameter from the iframe URL
    const hrefMatch = iframeSrc.match(/href=([^&"']+)/);
    
    if (hrefMatch) {
      const postUrl = decodeURIComponent(hrefMatch[1]);
      // Detect if it's a video/reel based on URL
      if (postUrl.includes('/videos/') || postUrl.includes('/watch/') || postUrl.includes('/reel/')) {
        return `<div class="fb-video" data-href="${postUrl}" data-width="auto" data-show-text="true"></div>`;
      }
      // Return SDK-compatible format for posts with auto width
      return `<div class="fb-post" data-href="${postUrl}" data-width="auto" data-show-text="true"></div>`;
    }
  }
  
  // If can't parse, return as is
  return html;
};

// Detect if content is Instagram (for rendering decisions like viewport-lock)
const isInstagramEmbed = (html: string): boolean => {
  return html.includes('instagram.com') || html.includes('instagram-media');
};

// Detect platform for SDK processing purposes
const detectPlatform = (html: string): 'instagram' | 'facebook' | 'facebook-iframe' | 'threads' | 'tiktok' | 'unknown' => {
  // Instagram iframes don't need SDK processing
  if (html.includes('instagram.com') && html.includes('<iframe')) {
    return 'unknown';
  }
  if (html.includes('instagram.com') || html.includes('instagram-media')) {
    return 'instagram';
  }
  // Facebook iframes — need error monitoring but not SDK processing
  if (html.includes('facebook.com/plugins/') && html.includes('<iframe')) {
    return 'facebook-iframe';
  }
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

export const RawEmbedRenderer = ({ embedHtml, onError }: RawEmbedRendererProps) => {
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
      } else if (platform === 'facebook-iframe') {
          // Monitor Facebook iframe for load failures
          const checkIframe = (timeout: number) => {
            setTimeout(() => {
              if (!containerRef.current) return;
              const iframe = containerRef.current.querySelector('iframe');
              if (!iframe) {
                setEmbedFailed(true);
                onError?.();
                return;
              }
              // Check if iframe has reasonable dimensions (not collapsed)
              const rect = iframe.getBoundingClientRect();
              if (rect.height < 50) {
                setEmbedFailed(true);
                onError?.();
              }
            }, timeout);
          };
          checkIframe(5000);
          checkIframe(10000);
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
    return (
      <div
        style={{ width: '100%', maxHeight: 520, overflow: 'hidden', position: 'relative' }}
      >
        <div
          ref={containerRef}
          className="embed-container w-full max-w-full [&>*]:!m-0 [&>blockquote]:!mb-0 [&>blockquote]:!pb-0 [&>iframe]:!block [&>div]:!mb-0 [&>iframe~*]:!hidden"
          style={{ overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onClick={handleDoubleTap}
      className="embed-container w-full max-w-full [&>*]:!m-0 [&_.fb-post]:!max-w-full [&_.fb-video]:!max-w-full cursor-pointer"
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
