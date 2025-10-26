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

  useEffect(() => {
    const processEmbed = async () => {
      if (!containerRef.current) return;

      try {
        // Load appropriate script based on platform
        if (platform === 'instagram') {
          await loadInstagramEmbed();
          
          // Process Instagram embeds after script loads
          if (window.instgrm?.Embeds?.process) {
            window.instgrm.Embeds.process();
          }
        } else if (platform === 'facebook') {
          await loadFacebookSDK();
          
          // Parse Facebook embeds after SDK loads
          if (window.FB?.XFBML?.parse) {
            window.FB.XFBML.parse(containerRef.current);
          }
        }
      } catch (error) {
        console.error('Failed to load embed script:', error);
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
