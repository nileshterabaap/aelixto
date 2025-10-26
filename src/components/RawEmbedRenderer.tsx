import { useEffect, useRef } from 'react';
import { loadInstagramEmbed, loadFacebookSDK } from '@/lib/ScriptLoader';

interface RawEmbedRendererProps {
  embedHtml: string;
}

// Strip script tags for security while preserving the embed HTML
const sanitizeEmbedHtml = (html: string): string => {
  // Remove <script> tags but keep blockquote/div content
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
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

export const RawEmbedRenderer = ({ embedHtml }: RawEmbedRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const platform = detectPlatform(embedHtml);
  const sanitizedHtml = sanitizeEmbedHtml(embedHtml);

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
          
          // Process Instagram embeds after script loads
          if (window.instgrm?.Embeds?.process) {
            console.log('[RawEmbedRenderer] Processing Instagram embed');
            window.instgrm.Embeds.process();
          }
        } else if (platform === 'facebook') {
          console.log('[RawEmbedRenderer] Loading Facebook SDK...');
          await loadFacebookSDK();
          
          console.log('[RawEmbedRenderer] Facebook SDK loaded, parsing embed...');
          // Parse Facebook embeds after SDK loads
          if (window.FB?.XFBML?.parse) {
            console.log('[RawEmbedRenderer] Parsing Facebook embed');
            window.FB.XFBML.parse(containerRef.current);
          } else {
            console.log('[RawEmbedRenderer] FB.XFBML.parse not available');
          }
        }
      } catch (error) {
        console.error('[RawEmbedRenderer] Failed to load embed script:', error);
      }
    };

    processEmbed();
  }, [embedHtml, platform]);

  return (
    <div 
      ref={containerRef}
      className="embed-container"
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
