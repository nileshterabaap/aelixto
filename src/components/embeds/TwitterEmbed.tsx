import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useExternalScript } from '@/hooks/useExternalScript';
import { useVisibility } from '@/hooks/useVisibility';

interface TwitterEmbedProps {
  url: string;
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void;
      };
    };
  }
}

export const TwitterEmbed = ({ url }: TwitterEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFallback, setShowFallback] = useState(false);
  const { status } = useExternalScript('https://platform.twitter.com/widgets.js');
  const isVisible = useVisibility(containerRef, 0.1);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (status === 'error') {
      setShowFallback(true);
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'ready' || !isVisible || !containerRef.current || hasLoadedRef.current) {
      return;
    }

    const loadTweet = () => {
      try {
        console.log('[TwitterEmbed] Loading tweet for:', url);
        
        if (window.twttr?.widgets && containerRef.current) {
          window.twttr.widgets.load(containerRef.current);
          hasLoadedRef.current = true;

          // Check if embed loaded after 2s
          setTimeout(() => {
            const hasIframe = containerRef.current?.querySelector('iframe');
            if (!hasIframe && !hasLoadedRef.current) {
              console.log('[TwitterEmbed] No iframe found after 2s, showing fallback');
              setShowFallback(true);
            }
          }, 2000);
        }
      } catch (err) {
        console.error('[TwitterEmbed] Error loading tweet:', err);
        setShowFallback(true);
      }
    };

    loadTweet();
  }, [status, isVisible, url]);

  if (showFallback) {
    return (
      <Card className="p-6 text-center space-y-3 rounded-2xl">
        <div className="flex justify-center">
          <svg
            className="w-12 h-12 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">
          Unable to load this post
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            View on X
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="twitter-embed-container" key={url}>
      {status === 'loading' && (
        <div className="rounded-2xl overflow-hidden bg-muted animate-pulse aspect-[4/3]" />
      )}
      <a
        className="twitter-tweet"
        href={url}
        data-dnt="true"
        data-theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
      >
        Loading...
      </a>
    </div>
  );
};
