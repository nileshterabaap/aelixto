import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useExternalScript } from '@/hooks/useExternalScript';
import { useVisibility } from '@/hooks/useVisibility';

interface FacebookEmbedProps {
  url: string;
}

declare global {
  interface Window {
    FB?: {
      XFBML: {
        parse: (element?: HTMLElement) => void;
      };
    };
  }
}

export const FacebookEmbed = ({ url }: FacebookEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);
  const { status } = useExternalScript('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0');
  const isVisible = useVisibility(containerRef);

  useEffect(() => {
    if (status === 'error') {
      setShowFallback(true);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'ready' && isVisible && containerRef.current && !hasLoadedRef.current) {
      hasLoadedRef.current = true;

      // Give FB SDK time to parse
      setTimeout(() => {
        if (window.FB?.XFBML) {
          window.FB.XFBML.parse(containerRef.current!);
        }
      }, 100);

      // Fallback detection - if no iframe after 5 seconds, show fallback
      setTimeout(() => {
        if (containerRef.current && !containerRef.current.querySelector('iframe')) {
          setShowFallback(true);
        }
      }, 5000);
    }
  }, [status, isVisible]);

  if (showFallback) {
    return (
      <Card className="overflow-hidden rounded-2xl border-2 border-foreground">
        <div className="aspect-video w-full bg-muted flex items-center justify-center">
          <svg
            className="w-16 h-16 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-3">
            This Facebook post couldn't be embedded. View it on Facebook.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              View on Facebook
            </a>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl relative">
      {(status === 'loading' || (status === 'ready' && !hasLoadedRef.current)) && (
        <Card className="overflow-hidden rounded-2xl border-2 border-foreground">
          <div className="aspect-video w-full bg-muted animate-pulse" />
        </Card>
      )}
      <div
        className="fb-post"
        data-href={url}
        data-width="500"
        data-show-text="true"
        style={{ display: 'none' }}
      />
    </div>
  );
};
