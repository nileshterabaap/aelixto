import { useEffect, useRef, useState } from 'react';
import { loadScript } from '@/lib/ScriptLoader';
import { Skeleton } from '@/components/ui/skeleton';

interface RawEmbedRendererProps {
  embedHtml: string;
}

// Strip script tags for security (we load official scripts separately)
const stripScripts = (html: string): string => {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

// Detect platform from embed HTML
const detectPlatform = (html: string): 'instagram' | 'facebook' | 'unknown' => {
  if (html.includes('instagram.com') || html.includes('cdninstagram.com')) {
    return 'instagram';
  }
  if (html.includes('facebook.com') || html.includes('fb.com')) {
    return 'facebook';
  }
  return 'unknown';
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
        parse: (container?: HTMLElement) => void;
      };
    };
  }
}

export const RawEmbedRenderer = ({ embedHtml }: RawEmbedRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const platform = detectPlatform(embedHtml);

  useEffect(() => {
    const initializeEmbed = async () => {
      try {
        setIsLoading(true);
        setError(false);

        // Load appropriate script based on platform
        if (platform === 'instagram') {
          await loadScript('https://www.instagram.com/embed.js');
          // Wait for DOM to be ready and Instagram SDK to be available
          await new Promise(resolve => setTimeout(resolve, 100));
          // Process Instagram embeds
          if (window.instgrm?.Embeds) {
            window.instgrm.Embeds.process();
          }
          // Give Instagram time to process
          await new Promise(resolve => setTimeout(resolve, 500));
        } else if (platform === 'facebook') {
          await loadScript('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0');
          // Wait a bit for FB SDK to initialize
          await new Promise(resolve => setTimeout(resolve, 500));
          // Process Facebook embeds
          if (window.FB?.XFBML && containerRef.current) {
            window.FB.XFBML.parse(containerRef.current);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load embed:', err);
        setError(true);
        setIsLoading(false);
      }
    };

    if (embedHtml && containerRef.current) {
      initializeEmbed();
    }
  }, [embedHtml, platform]);

  const sanitizedHtml = stripScripts(embedHtml);

  if (error) {
    return (
      <div className="rounded-2xl overflow-hidden bg-muted p-4 text-center text-sm text-muted-foreground">
        Unable to load embed. The content may be unavailable.
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {isLoading && (
        <Skeleton className="absolute inset-0 z-10 rounded-2xl" />
      )}
      <div
        ref={containerRef}
        className="embed-container"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
};
