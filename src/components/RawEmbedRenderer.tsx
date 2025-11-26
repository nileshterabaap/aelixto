import { useEffect, useRef, useState } from 'react';
import { loadInstagramEmbed, loadFacebookSDK } from '@/lib/ScriptLoader';

interface RawEmbedRendererProps {
  embedHtml: string;
  onError?: () => void;
}

// Strip script tags for security while preserving the embed HTML
const sanitizeEmbedHtml = (html: string): string => {
  // Remove <script> tags but keep blockquote/div content
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

// Convert Facebook iframe embed to SDK-compatible format
const transformFacebookEmbed = (html: string): string => {
  // If already in SDK format (fb-post, fb-video), return as is
  if (html.includes('fb-post') || html.includes('fb-video')) {
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
        return `<div class="fb-video" data-href="${postUrl}" data-show-text="true"></div>`;
      }
      // Return SDK-compatible format for posts
      return `<div class="fb-post" data-href="${postUrl}" data-show-text="true"></div>`;
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
  const [embedFailed, setEmbedFailed] = useState(false);
  const platform = detectPlatform(embedHtml);
  let sanitizedHtml = sanitizeEmbedHtml(embedHtml);
  
  // Transform Facebook embeds to SDK-compatible format
  if (platform === 'facebook') {
    sanitizedHtml = transformFacebookEmbed(sanitizedHtml);
  }

  console.log('[RawEmbedRenderer] Platform detected:', platform);
  console.log('[RawEmbedRenderer] Embed HTML:', embedHtml);

  useEffect(() => {
    const processEmbed = async () => {
      if (!containerRef.current) return;

      console.log('[RawEmbedRenderer] Processing embed for platform:', platform);

      try {
        // Load appropriate script based on platform
        if (platform === 'instagram') {
          console.log('[RawEmbedRenderer] Loading Instagram script...');
          await loadInstagramEmbed();
          
          // Wait a bit for DOM to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Process Instagram embeds after script loads with retry
          const processWithRetry = async (attempts = 3) => {
            for (let i = 0; i < attempts; i++) {
              if (window.instgrm?.Embeds?.process) {
                console.log(`[RawEmbedRenderer] Processing Instagram embed (attempt ${i + 1})`);
                try {
                  window.instgrm.Embeds.process();
                  
                  // Check if embed rendered successfully after a delay
                  setTimeout(() => {
                    if (containerRef.current) {
                      const hasIframe = containerRef.current.querySelector('iframe');
                      if (!hasIframe) {
                        console.log('[RawEmbedRenderer] Instagram embed failed to render iframe, triggering fallback');
                        setEmbedFailed(true);
                        onError?.();
                      }
                    }
                  }, 3000);
                  break;
                } catch (e) {
                  console.error('[RawEmbedRenderer] Error processing Instagram embed:', e);
                  if (i === attempts - 1) {
                    setEmbedFailed(true);
                    onError?.();
                  }
                }
              }
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          };
          
          await processWithRetry();
        } else if (platform === 'facebook') {
          console.log('[RawEmbedRenderer] Loading Facebook SDK...');
          await loadFacebookSDK();
          
            console.log('[RawEmbedRenderer] Facebook SDK loaded, parsing embed...');
            // Parse Facebook embeds after SDK loads
            if (window.FB?.XFBML?.parse) {
              console.log('[RawEmbedRenderer] Parsing Facebook embed');
              window.FB.XFBML.parse(containerRef.current);
              
              // Check for errors multiple times with more aggressive detection
              const checkForError = () => {
                if (containerRef.current) {
                  const text = (containerRef.current.textContent || '').toLowerCase();
                  const fbError = containerRef.current.querySelector('.fb-error');
                  
                  console.log('[RawEmbedRenderer] Checking for FB errors. Text length:', text.length, 'Text:', text.substring(0, 200));
                  
                  // Aggressive error detection - check for ANY Facebook error indicators
                  const hasError = fbError ||
                    text.includes('no longer available') ||
                    text.includes('been removed') ||
                    text.includes('privacy setting') ||
                    text.includes('privacy settings') ||
                    text.includes('this content') ||
                    text.includes("isn't available") ||
                    text.includes('content not found') ||
                    text.includes('post is no longer') ||
                    text.includes('may have changed') ||
                    text.includes('help center') ||
                    text.includes('facebook post is no longer') ||
                    text.includes('or the privacy') ||
                    // Check for login-related errors
                    text.includes('log in to facebook') ||
                    text.includes('login to facebook') ||
                    // If there's text but no iframe after checking, it's likely an error
                    (text.length > 30 && !containerRef.current.querySelector('iframe'));
                  
                  if (hasError) {
                    console.log('[RawEmbedRenderer] Facebook embed error detected! Text:', text.substring(0, 200));
                    setEmbedFailed(true);
                    onError?.();
                    return true;
                  }
                }
                return false;
              };
              
              // Check at 500ms, 1.5s, 3s, and 5s intervals
              setTimeout(() => {
                if (checkForError()) return;
                setTimeout(() => {
                  if (checkForError()) return;
                  setTimeout(() => {
                    if (checkForError()) return;
                    setTimeout(checkForError, 2000);
                  }, 1500);
                }, 1000);
              }, 500);
            } else {
              console.log('[RawEmbedRenderer] FB.XFBML.parse not available');
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
    return null; // Let parent component show fallback
  }

  return (
    <div 
      ref={containerRef}
      className="embed-container w-full max-h-[700px] overflow-auto [&>*]:!m-0 [&>iframe]:w-full [&>iframe]:block"
      style={{ minHeight: 0, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

// Type declarations for global window objects
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
