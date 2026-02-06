import { useEffect, useRef, useState } from 'react';
import { loadInstagramEmbed, loadFacebookSDK } from '@/lib/ScriptLoader';
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
    ALLOWED_TAGS: ['blockquote', 'div', 'iframe', 'a', 'p', 'br', 'span', 'img'],
    ALLOWED_ATTR: ['class', 'data-href', 'data-width', 'data-show-text', 'data-instgrm-permalink', 'data-instgrm-version', 'href', 'src', 'style', 'target', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'loading', 'alt'],
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

// Detect platform from embed HTML
const detectPlatform = (html: string): 'instagram' | 'facebook' | 'unknown' => {
  if (html.includes('instagram.com') || html.includes('instagram-media')) {
    return 'instagram';
  }
  if (html.includes('facebook.com') || html.includes('fb-post') || html.includes('fb-video')) {
    return 'facebook';
  }
  return 'unknown';
};

export const RawEmbedRenderer = ({ embedHtml, onError }: RawEmbedRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const [embedFailed, setEmbedFailed] = useState(false);
  const platform = detectPlatform(embedHtml);
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
      // Double tap detected
      const url = getEmbedUrl();
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
    
    lastTapRef.current = now;
  };


  useEffect(() => {
    const processEmbed = async () => {
      if (!containerRef.current) return;

      try {
        if (platform === 'instagram') {
          await loadInstagramEmbed();
          
          // Process immediately if ready
          if (window.instgrm?.Embeds?.process) {
            window.instgrm.Embeds.process();
            
            // Check if embed rendered successfully after a short delay
            setTimeout(() => {
              if (containerRef.current) {
                const hasIframe = containerRef.current.querySelector('iframe');
                if (!hasIframe) {
                  setEmbedFailed(true);
                  onError?.();
                }
              }
            }, 2000);
          }
        } else if (platform === 'facebook') {
          await loadFacebookSDK();
          
          // Parse immediately
          if (window.FB?.XFBML?.parse) {
            window.FB.XFBML.parse(containerRef.current);
            
            // Check for errors after render
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
                  (text.length > 30 && !iframe);
                
                if (hasError) {
                  setEmbedFailed(true);
                  onError?.();
                }
              }
            }, 2000);
          }
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

  return (
    <div 
      ref={containerRef}
      onClick={handleDoubleTap}
      className="embed-container w-full max-w-full min-h-[300px] [&>*]:!m-0 [&_.fb-post]:!max-w-full [&_.fb-video]:!max-w-full cursor-pointer"
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
  }
}
