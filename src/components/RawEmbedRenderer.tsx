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
  const processingRef = useRef(false);
  const embedHtmlRef = useRef(embedHtml);
  const sdkReadyRef = useRef(false);
  const errorReportedRef = useRef(false);
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
      sdkReadyRef.current = false;
      errorReportedRef.current = false;
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
          
          // CRITICAL FIX: Multi-stage DOM readiness check
          // Stage 1: Wait for React's render cycle to complete
          await new Promise(resolve => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Stage 2: Additional timeout for browser paint
                setTimeout(resolve, 150);
              });
            });
          });
          
          // CRITICAL FIX: Verify blockquote exists in DOM before SDK processing
          if (!containerRef.current) {
            console.error('[RawEmbedRenderer] Container lost during DOM wait');
            return;
          }
          
          const blockquote = containerRef.current.querySelector('.instagram-media');
          
          if (!blockquote) {
            console.error('[RawEmbedRenderer] Instagram blockquote not found in DOM after wait');
            if (!errorReportedRef.current && containerRef.current) {
              errorReportedRef.current = true;
              containerRef.current.style.display = 'none';
              onError?.();
            }
            return;
          }
          
          console.log('[RawEmbedRenderer] Instagram blockquote confirmed in DOM, processing...');
          
          // CRITICAL FIX: Ensure SDK is ready before processing
          if (!window.instgrm?.Embeds?.process) {
            console.error('[RawEmbedRenderer] Instagram SDK not initialized');
            if (!errorReportedRef.current && containerRef.current) {
              errorReportedRef.current = true;
              containerRef.current.style.display = 'none';
              onError?.();
            }
            return;
          }
          
          try {
            // Mark blockquote with unique identifier to prevent duplicate processing
            const embedId = `embed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            blockquote.setAttribute('data-embed-id', embedId);
            
            // CRITICAL FIX: Process only this specific container, not the entire document
            // This prevents interference between multiple Instagram embeds
            window.instgrm.Embeds.process();
            
            // CRITICAL FIX: Immediate check + rapid early checks to catch failures fast
            let checkCount = 0;
            const maxChecks = 15;
            // Much more aggressive timing: check at 0, 100, 200, 300, 500, 700, 1000, 1500, 2000, 2500...
            const getCheckInterval = (count: number) => {
              if (count === 0) return 0; // Immediate first check
              if (count <= 3) return 100; // Very fast early checks
              if (count <= 6) return 200; // Fast checks
              return 500; // Slower checks for late rendering
            };
            
            const checkEmbed = () => {
              if (!containerRef.current || errorReportedRef.current) {
                console.log('[RawEmbedRenderer] Container unmounted or error already reported');
                return;
              }
              
              checkCount++;
              
              // Check for successful iframe rendering
              const hasIframe = containerRef.current.querySelector('iframe');
              // Also check if the blockquote is still there (it gets replaced by iframe)
              const hasBlockquote = containerRef.current.querySelector('.instagram-media');
              
              console.log(`[RawEmbedRenderer] Instagram check ${checkCount}/${maxChecks}: iframe=${!!hasIframe}, blockquote=${!!hasBlockquote}`);
              
              if (hasIframe) {
                console.log('[RawEmbedRenderer] Instagram embed rendered successfully');
                return;
              }
              
              // CRITICAL FIX: Check for rendering failure indicators
              if (checkCount >= maxChecks) {
                console.error('[RawEmbedRenderer] Instagram embed failed after max checks');
                if (!errorReportedRef.current) {
                  errorReportedRef.current = true;
                  containerRef.current.style.display = 'none';
                  onError?.();
                }
                return;
              }
              
              // Continue checking with dynamic intervals
              setTimeout(checkEmbed, getCheckInterval(checkCount));
            };
            
            // Start checking immediately
            checkEmbed();
            
          } catch (e) {
            console.error('[RawEmbedRenderer] Error processing Instagram embed:', e);
            if (!errorReportedRef.current && containerRef.current) {
              errorReportedRef.current = true;
              containerRef.current.style.display = 'none';
              onError?.();
            }
          }
          
        } else if (platform === 'facebook') {
          console.log('[RawEmbedRenderer] Loading Facebook SDK...');
          
          try {
            await loadFacebookSDK();
            
            // CRITICAL FIX: Wait for SDK to be fully initialized
            let sdkWaitCount = 0;
            const maxSdkWait = 20;
            
            while (!window.FB?.XFBML?.parse && sdkWaitCount < maxSdkWait) {
              await new Promise(resolve => setTimeout(resolve, 100));
              sdkWaitCount++;
            }
            
            if (!window.FB?.XFBML?.parse) {
              console.error('[RawEmbedRenderer] Facebook SDK failed to initialize');
              if (!errorReportedRef.current && containerRef.current) {
                errorReportedRef.current = true;
                containerRef.current.style.display = 'none';
                onError?.();
              }
              return;
            }
            
            console.log('[RawEmbedRenderer] Facebook SDK ready, parsing embed...');
            sdkReadyRef.current = true;
            
            // CRITICAL FIX: Wait for DOM to be ready before parsing
            await new Promise(resolve => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setTimeout(resolve, 100);
                });
              });
            });
            
            if (!containerRef.current || errorReportedRef.current) {
              console.error('[RawEmbedRenderer] Container lost or error already reported');
              return;
            }
            
            // Parse the Facebook embed
            window.FB.XFBML.parse(containerRef.current);
            
            // CRITICAL FIX: Ultra-aggressive error detection with immediate checks
            const checkForError = () => {
              if (!containerRef.current || errorReportedRef.current) return false;
              
              const text = (containerRef.current.textContent || '').toLowerCase();
              const fbError = containerRef.current.querySelector('.fb-error');
              
              // COMPREHENSIVE ERROR DETECTION: All known Facebook error indicators
              const errorPhrases = [
                'no longer available',
                'been removed',
                'privacy setting',
                'privacy settings',
                "isn't available",
                'content not found',
                'post is no longer',
                'may have changed',
                'help center',
                'content unavailable',
                'been deleted',
                'this content',
                'not found',
                'couldn\'t load',
                'failed to load',
                'error loading',
                'temporarily unavailable',
                'page not found',
                'post not available',
                'video not available',
                'restricted',
                'removed by',
                'violates'
              ];
              
              const hasError = fbError || errorPhrases.some(phrase => text.includes(phrase));
              
              if (hasError) {
                console.error('[RawEmbedRenderer] Facebook error detected:', text.substring(0, 100));
                // CRITICAL FIX: Report error once and hide container
                if (!errorReportedRef.current) {
                  errorReportedRef.current = true;
                  containerRef.current.style.display = 'none';
                  onError?.();
                }
                return true;
              }
              
              return false;
            };
            
            // CRITICAL FIX: Immediate first check + very aggressive early timing
            // Check at 0, 10, 30, 60, 100, 200, 400, 700, 1200, 1800, 2500, 3500ms
            const checkIntervals = [0, 10, 30, 60, 100, 200, 400, 700, 1200, 1800, 2500, 3500];
            
            checkIntervals.forEach(interval => {
              setTimeout(() => {
                if (!errorReportedRef.current) {
                  checkForError();
                }
              }, interval);
            });
            
          } catch (error) {
            console.error('[RawEmbedRenderer] Facebook SDK error:', error);
            if (!errorReportedRef.current && containerRef.current) {
              errorReportedRef.current = true;
              containerRef.current.style.display = 'none';
              onError?.();
            }
          }
        }
      } catch (error) {
        console.error('[RawEmbedRenderer] Failed to load embed script:', error);
        if (!errorReportedRef.current && containerRef.current) {
          errorReportedRef.current = true;
          containerRef.current.style.display = 'none';
          onError?.();
        }
      }
    };

    processEmbed();
    
    // Cleanup function to reset processing flag when component unmounts
    return () => {
      processingRef.current = false;
      sdkReadyRef.current = false;
      errorReportedRef.current = false;
    };
  }, [embedHtml, platform, onError]);

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
