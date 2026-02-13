import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import pinterestIcon from "@/assets/platforms/pinterest.svg";
import { loadPinterestEmbed } from "@/lib/ScriptLoader";

interface PinterestEmbedProps {
  url: string;
}

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);
  const [embedReady, setEmbedReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadEmbed = async () => {
      let finalUrl = url;

      // If it's a pin.it short link, expand it first
      if (url.includes('pin.it/')) {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data, error } = await supabase.functions.invoke('expand-pin', {
            body: { url }
          });
          if (error) throw error;
          if (data?.finalUrl) {
            finalUrl = data.finalUrl;
            if (!cancelled) setResolvedUrl(finalUrl);
          } else {
            throw new Error("No final URL returned");
          }
        } catch {
          if (!cancelled) { setEmbedFailed(true); setIsLoading(false); }
          return;
        }
      }

      // Validate Pinterest URL
      const isPinterestPin = /pinterest\.com\/pin\/[a-zA-Z0-9]+\/?/.test(finalUrl);
      if (!isPinterestPin) {
        if (!cancelled) { setEmbedFailed(true); setIsLoading(false); }
        return;
      }

      // Load Pinterest script
      try {
        await loadPinterestEmbed();
        setTimeout(() => {
          if (window.PinUtils) {
            window.PinUtils.build();
          }
        }, 100);
      } catch {
        if (!cancelled) { setEmbedFailed(true); setIsLoading(false); }
      }
    };

    loadEmbed();

    // MutationObserver to detect when Pinterest SDK replaces the <a> with actual embed content
    // AND to remove save buttons
    const observer = new MutationObserver(() => {
      if (!containerRef.current) return;
      
      // Check if Pinterest SDK has rendered real content (it creates a span/embed container)
      const hasRendered = containerRef.current.querySelector('span[data-pin-id], span[style]');
      if (hasRendered && !cancelled) {
        setEmbedReady(true);
        setIsLoading(false);
      }

      // Remove Pinterest save buttons
      const saveButtons = containerRef.current.querySelectorAll(
        'span[data-pin-log], a[data-pin-log], button[data-pin-save="true"], .pin-save-button, span[data-pin-href]'
      );
      saveButtons.forEach(button => button.remove());
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    // Timeout: if embed doesn't render within 10s, show fallback
    const timeout = setTimeout(() => {
      if (!cancelled && !embedReady) {
        setEmbedFailed(true);
        setIsLoading(false);
      }
    }, 10000);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [url]);

  // Fallback card if Pinterest embed fails
  if (embedFailed) {
    return (
      <Card className="p-6 flex flex-col items-center gap-4">
        <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
        <p className="text-sm text-muted-foreground text-center">
          Unable to load Pinterest post
        </p>
        <Button
          variant="outline"
          onClick={() => window.open(url, '_blank')}
        >
          View on Pinterest
        </Button>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-[500px] mx-auto relative">
      {/* Loading overlay - visible until SDK renders real content */}
      {isLoading && (
        <Card className="p-6 flex flex-col items-center gap-4 absolute inset-0 z-10">
          <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
          <p className="text-sm text-muted-foreground text-center">
            Loading Pinterest post..
          </p>
        </Card>
      )}
      
      {/* Actual Pinterest embed container - hidden until ready, then fades in */}
      <div 
        ref={containerRef} 
        className={`pinterest-embed-container w-full flex flex-col justify-center transition-opacity duration-500 ${
          embedReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <a 
          data-pin-do="embedPin" 
          data-pin-width="medium"
          href={resolvedUrl}
        />
      </div>
    </div>
  );
};

// Extend window type for Pinterest
declare global {
  interface Window {
    PinUtils?: {
      build: () => void;
    };
  }
}
