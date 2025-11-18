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
        return `<div class="fb-video" data-href="${postUrl}" data-width="500" data-show-text="true"></div>`;
      }
      // Return SDK-compatible format for posts
      return `<div class="fb-post" data-href="${postUrl}" data-width="500" data-show-text="true"></div>`;
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
  const processingRef = useRef(false);
  const embedHtmlRef = useRef(embedHtml);
  const platform = detectPlatform(embedHtml);
  let sanitizedHtml = sanitizeEmbedHtml(embedHtml);
  
  // Transform Facebook embeds to SDK-compatible format
  if (platform === 'facebook') {
    sanitizedHtml = transformFacebookEmbed(sanitizedHtml);
  }

  console.log('[RawEmbedRenderer] Platform detected:', platform);
  console.log('[RawEmbedRenderer] Embed HTML:', embedHtml);

  useEffect(() => {
    // Only reset if embed HTML actually changed
    if (embedHtmlRef.current !== embedHtml) {
      embedHtmlRef.current = embedHtml;
      processingRef.current = false;
      setEmbedFailed(false);
    }
    
    const processEmbed = async () => {
      if (!containerRef.current || processingRef.current) return;

      console.log('[RawEmbedRenderer] Processing embed for platform:', platform);
      processingRef.current = true;

      try {
        // Load appropriate script based on platform
        if (platform === 'instagram') {
          console.log('[RawEmbedRenderer] Loading Instagram script...');
          await loadInstagramEmbed();
          
          // Critical: Wait for React to commit the DOM changes from dangerouslySetInnerHTML
          // Use requestAnimationFrame to ensure DOM is fully updated
          await new Promise(resolve => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setTimeout(resolve, 100);
              });
            });
          });
          
          // Verify blockquote is in DOM before processing
          if (!containerRef.current) return;
          const blockquote = containerRef.current.querySelector('.instagram-media');
          
          if (!blockquote) {
            console.error('[RawEmbedRenderer] Instagram blockquote not found in DOM');
            setEmbedFailed(true);
            onError?.();
            return;
          }
          
          console.log('[RawEmbedRenderer] Instagram blockquote found, processing...');
          
          // Process Instagram embeds
          if (window.instgrm?.Embeds?.process) {
            try {
              // Call process on the entire document (Instagram's SDK handles this)
              window.instgrm.Embeds.process();
              
              // Check if embed rendered successfully
              let checkCount = 0;
              const maxChecks = 6;
              const checkInterval = 800;
              
              const checkEmbed = () => {
                if (!containerRef.current) return;
                
                checkCount++;
                const hasIframe = containerRef.current.querySelector('iframe');
                
                console.log(`[RawEmbedRenderer] Instagram check ${checkCount}/${maxChecks}: iframe=${!!hasIframe}`);
                
                if (hasIframe) {
                  console.log('[RawEmbedRenderer] Instagram embed rendered successfully');
                  return;
                }
                
                if (checkCount >= maxChecks) {
                  console.log('[RawEmbedRenderer] Instagram embed failed after max checks, triggering fallback');
                  setEmbedFailed(true);
                  onError?.();
                  return;
                }
                
                // Continue checking
                setTimeout(checkEmbed, checkInterval);
              };
              
              // Start checking after initial delay
              setTimeout(checkEmbed, checkInterval);
              
            } catch (e) {
              console.error('[RawEmbedRenderer] Error processing Instagram embed:', e);
              setEmbedFailed(true);
              onError?.();
            }
          } else {
            console.error('[RawEmbedRenderer] Instagram Embeds API not available');
            setEmbedFailed(true);
            onError?.();
          }
        } else if (platform === 'facebook') {
          console.log('[RawEmbedRenderer] Loading Facebook SDK...');
          await loadFacebookSDK();
          
            console.log('[RawEmbedRenderer] Facebook SDK loaded, parsing embed...');
            // Parse Facebook embeds after SDK loads
            if (window.FB?.XFBML?.parse) {
              console.log('[RawEmbedRenderer] Parsing Facebook embed');
              window.FB.XFBML.parse(containerRef.current);
              
              // Check for errors multiple times with very aggressive early detection
              const checkForError = () => {
                if (containerRef.current) {
                  const text = (containerRef.current.textContent || '').toLowerCase();
                  const fbError = containerRef.current.querySelector('.fb-error');
                  
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
                    text.includes('help center');
                  
                  if (hasError) {
                    console.log('[RawEmbedRenderer] Facebook error detected! Hiding embed and triggering fallback');
                    // Hide the container immediately
                    if (containerRef.current) {
                      containerRef.current.style.display = 'none';
                    }
                    setEmbedFailed(true);
                    onError?.();
                    return true;
                  }
                }
                return false;
              };
              
              // Very aggressive checking - start at 100ms and check frequently
              const checkIntervals = [100, 300, 500, 800, 1200, 1800, 2500, 3500];
              checkIntervals.forEach(interval => {
                setTimeout(() => {
                  checkForError();
                }, interval);
              });
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
    
    // Cleanup function to reset processing flag when component unmounts
    return () => {
      processingRef.current = false;
    };
  }, [embedHtml, platform, onError]);

  if (embedFailed) {
    return null; // Let parent component show fallback
  }

  return (
    <div 
      ref={containerRef}
      className="embed-container w-full [&>*]:!m-0 [&>iframe]:w-full [&>iframe]:block"
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
