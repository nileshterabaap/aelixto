import { useEffect, useRef, useState } from "react";
import pinterestIcon from "@/assets/platforms/pinterest.svg";
import { loadPinterestEmbed } from "@/lib/ScriptLoader";

interface PinterestEmbedProps {
  url: string;
}

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [isExpanding, setIsExpanding] = useState(false);
  const [pinTitle, setPinTitle] = useState<string>("");

  useEffect(() => {
    const loadEmbed = async () => {
      let finalUrl = url;

      // If it's a pin.it short link, expand it first
      if (url.includes('pin.it/')) {
        setIsExpanding(true);
        
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data, error } = await supabase.functions.invoke('expand-pin', {
            body: { url }
          });

          if (error) throw error;
          
          if (data?.finalUrl) {
            finalUrl = data.finalUrl;
            setResolvedUrl(finalUrl);
          } else {
            throw new Error("No final URL returned");
          }
        } catch {
          setEmbedFailed(true);
          setIsExpanding(false);
          return;
        }
        
        setIsExpanding(false);
      }

      // Fetch pin metadata using Pinterest oEmbed API
      try {
        const oembedUrl = `https://www.pinterest.com/oembed/?url=${encodeURIComponent(finalUrl)}`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.title) {
            setPinTitle(data.title);
          }
        }
      } catch {
        // Non-critical: title is optional
      }

      // Validate Pinterest URL
      const isPinterestPin = /pinterest\.com\/pin\/[a-zA-Z0-9]+\/?/.test(finalUrl);
      if (!isPinterestPin) {
        setEmbedFailed(true);
        return;
      }

      // Load Pinterest script using ScriptLoader
      try {
        await loadPinterestEmbed();
        
        // Process embeds after script loads
        setTimeout(() => {
          if (window.PinUtils) {
            window.PinUtils.build();
          }
        }, 100);
        
        // Check if embed actually rendered after SDK processing
        setTimeout(() => {
          if (containerRef.current) {
            const hasRendered = containerRef.current.querySelector('span[data-pin-href], iframe, img');
            if (!hasRendered) {
              setEmbedFailed(true);
            }
          }
        }, 4000);
      } catch {
        setEmbedFailed(true);
      }
    };

    loadEmbed();

    // MutationObserver to remove Pinterest save buttons after they load
    const observer = new MutationObserver(() => {
      if (containerRef.current) {
        const saveButtons = containerRef.current.querySelectorAll(
          'span[data-pin-log], a[data-pin-log], button[data-pin-save="true"], .pin-save-button, span[data-pin-href]'
        );
        saveButtons.forEach(button => button.remove());
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [url]);

  if (isExpanding) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 border border-border rounded-xl bg-card">
        <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
        <p className="text-sm text-muted-foreground text-center">
          Loading Pinterest embed...
        </p>
      </div>
    );
  }

  if (embedFailed) {
    return (
      <div 
        className="rounded-xl overflow-hidden border border-border bg-card cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      >
        <div className="flex items-center gap-3 p-4">
          <img src={pinterestIcon} alt="Pinterest" className="w-8 h-8" />
          <div className="flex-1 min-w-0">
            {pinTitle && <p className="text-sm font-medium text-foreground line-clamp-2">{pinTitle}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">View on Pinterest</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[500px] mx-auto">
      <div ref={containerRef} className="pinterest-embed-container w-full flex flex-col justify-center">
        {pinTitle && (
          <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-t-lg border border-b-0">
            <img src={pinterestIcon} alt="Pinterest" className="w-5 h-5" />
            <span className="text-sm font-medium text-foreground line-clamp-1">{pinTitle}</span>
          </div>
        )}
        <a 
          data-pin-do="embedPin" 
          data-pin-width="medium"
          href={resolvedUrl}
          className={pinTitle ? "rounded-t-none" : ""}
        >
          View Pin
        </a>
      </div>
    </div>
  );
};

declare global {
  interface Window {
    PinUtils?: {
      build: () => void;
    };
  }
}
