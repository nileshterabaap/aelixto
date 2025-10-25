import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useExternalScript } from '@/hooks/useExternalScript';
import { useVisibility } from '@/hooks/useVisibility';
import { supabase } from '@/integrations/supabase/client';

interface PinterestEmbedProps {
  url: string;
}

declare global {
  interface Window {
    PinUtils?: {
      build: (element?: HTMLElement) => void;
    };
  }
}

const expandPinUrl = async (url: string): Promise<string> => {
  // If it's a pin.it short link, expand it
  if (url.includes('pin.it/')) {
    try {
      const { data, error } = await supabase.functions.invoke('expand-pin', {
        body: { url }
      });
      if (!error && data?.finalUrl) {
        return data.finalUrl;
      }
    } catch (err) {
      console.error('[PinterestEmbed] Error expanding URL:', err);
    }
  }
  return url;
};

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [finalUrl, setFinalUrl] = useState(url);
  const { status } = useExternalScript(
    'https://assets.pinterest.com/js/pinit.js',
    { 'data-pin-hover': 'false' }
  );
  const isVisible = useVisibility(containerRef, 0.1);
  const hasLoadedRef = useRef(false);

  // Expand URL on mount
  useEffect(() => {
    expandPinUrl(url).then(setFinalUrl);
  }, [url]);

  useEffect(() => {
    if (status === 'error') {
      setShowFallback(true);
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'ready' || !isVisible || !containerRef.current || hasLoadedRef.current) {
      return;
    }

    const loadPin = () => {
      try {
        console.log('[PinterestEmbed] Loading pin for:', finalUrl);

        if (window.PinUtils?.build && containerRef.current) {
          // Build the embed
          window.PinUtils.build(containerRef.current);
          hasLoadedRef.current = true;

          // Remove Save buttons immediately
          setTimeout(() => removeSaveButtons(), 100);

          // Set up mutation observer to remove Save buttons
          const observer = new MutationObserver(() => {
            removeSaveButtons();
          });

          if (containerRef.current) {
            observer.observe(containerRef.current, {
              childList: true,
              subtree: true,
            });
          }

          // Check if embed loaded after 2s
          setTimeout(() => {
            const hasEmbed = containerRef.current?.querySelector('span[data-pin-id]');
            if (!hasEmbed) {
              console.log('[PinterestEmbed] No embed found after 2s, showing fallback');
              setShowFallback(true);
            }
          }, 2000);

          return () => observer.disconnect();
        }
      } catch (err) {
        console.error('[PinterestEmbed] Error loading pin:', err);
        setShowFallback(true);
      }
    };

    const removeSaveButtons = () => {
      if (!containerRef.current) return;

      const selectors = [
        'a[data-pin-log]',
        'button[data-pin-log]',
        'span[data-pin-log]',
        '[data-test-id*="Save"]',
        '[aria-label="Save"]',
        '[data-test-id="saveButton"]',
      ];

      selectors.forEach(selector => {
        const elements = containerRef.current!.querySelectorAll(selector);
        elements.forEach(el => {
          (el as HTMLElement).style.display = 'none';
          (el as HTMLElement).style.visibility = 'hidden';
        });
      });
    };

    loadPin();
  }, [status, isVisible, finalUrl]);

  if (showFallback) {
    return (
      <Card className="p-6 text-center space-y-3 rounded-2xl">
        <div className="flex justify-center">
          <svg
            className="w-12 h-12 text-red-600"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">
          Unable to load this pin
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={finalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Pinterest
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="pinterest-embed-container" key={finalUrl}>
      {status === 'loading' && (
        <div className="rounded-2xl overflow-hidden bg-muted animate-pulse aspect-[4/3]" />
      )}
      <a
        data-pin-do="embedPin"
        data-pin-width="medium"
        href={finalUrl}
      >
        Loading...
      </a>
      <style>{`
        .pinterest-embed-container a[data-pin-log],
        .pinterest-embed-container button[data-pin-log],
        .pinterest-embed-container span[data-pin-log],
        .pinterest-embed-container [data-test-id*="Save"],
        .pinterest-embed-container [aria-label="Save"],
        .pinterest-embed-container [data-test-id="saveButton"] {
          display: none !important;
          visibility: hidden !important;
        }
      `}</style>
    </div>
  );
};
