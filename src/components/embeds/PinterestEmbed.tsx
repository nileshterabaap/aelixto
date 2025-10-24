import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import pinterestIcon from "@/assets/pinterest-icon.png";

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
      console.log("[PinterestEmbed] Loading Pinterest embed for URL:", url);
      
      let finalUrl = url;

      // If it's a pin.it short link, expand it first
      if (url.includes('pin.it/')) {
        console.log("[PinterestEmbed] Detected pin.it short link, expanding...");
        setIsExpanding(true);
        
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data, error } = await supabase.functions.invoke('expand-pin', {
            body: { url }
          });

          if (error) throw error;
          
          if (data?.finalUrl) {
            finalUrl = data.finalUrl;
            console.log("[PinterestEmbed] Expanded to:", finalUrl);
            setResolvedUrl(finalUrl);
          } else {
            throw new Error("No final URL returned");
          }
        } catch (error) {
          console.error("[PinterestEmbed] Failed to expand short link:", error);
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
            console.log("[PinterestEmbed] Fetched pin title:", data.title);
          }
        }
      } catch (error) {
        console.warn("[PinterestEmbed] Failed to fetch pin metadata:", error);
      }

      // Validate Pinterest URL - must be a pin URL with digits or alphanumeric ID
      const isPinterestPin = /pinterest\.com\/pin\/[a-zA-Z0-9]+\/?/.test(finalUrl);
      if (!isPinterestPin) {
        console.warn("[PinterestEmbed] Invalid Pinterest pin URL:", finalUrl);
        setEmbedFailed(true);
        return;
      }

      // Load Pinterest script only once
      if (!window.PinUtils) {
        const existingScript = document.querySelector('script[src="https://assets.pinterest.com/js/pinit.js"]');
        
        if (!existingScript) {
          const script = document.createElement("script");
          script.src = "https://assets.pinterest.com/js/pinit.js";
          script.async = true;
          document.body.appendChild(script);

          script.onload = () => {
            console.log("[PinterestEmbed] Pinterest script loaded successfully");
            setTimeout(() => {
              if (window.PinUtils) {
                window.PinUtils.build();
                console.log("[PinterestEmbed] Pinterest embeds processed");
              }
            }, 500);
          };

          script.onerror = () => {
            console.error("[PinterestEmbed] Failed to load Pinterest script");
            setEmbedFailed(true);
          };
        }
      } else {
        // Script already loaded, just build
        setTimeout(() => {
          if (window.PinUtils) {
            window.PinUtils.build();
            console.log("[PinterestEmbed] Pinterest embeds processed");
          }
        }, 500);
      }
    };

    loadEmbed();

    return () => {};
  }, [url]);

  // Show loading state while expanding
  if (isExpanding) {
    return (
      <Card className="p-6 flex flex-col items-center gap-4">
        <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
        <p className="text-sm text-muted-foreground text-center">
          Loading Pinterest embed...
        </p>
      </Card>
    );
  }

  // Fallback card if Pinterest embed fails
  if (embedFailed) {
    return (
      <Card className="p-6 flex flex-col items-center gap-4">
        <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
        <p className="text-sm text-muted-foreground text-center">
          Unable to load Pinterest embed
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
    <div className="w-full max-w-[500px] mx-auto">
      <div ref={containerRef} className="pinterest-embed-container w-full flex flex-col justify-center [&_span[data-pin-log='button_pinit_bookmarklet']]:hidden [&_span[data-pin-log='embed_pin_button']]:hidden [&_.pin-save-button]:hidden [&_a[data-pin-log='button_pinit']]:!hidden [&_.PIN_1745533230427_button_pin]:!hidden [&_span]:has([data-pin-log]):!hidden">
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
