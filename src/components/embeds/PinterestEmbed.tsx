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

  useEffect(() => {
    console.log("[PinterestEmbed] Loading Pinterest embed for URL:", url);
    
    // Validate Pinterest URL
    const isPinterestPin = url.includes('pinterest.com/pin/');
    if (!isPinterestPin) {
      console.warn("[PinterestEmbed] Invalid Pinterest URL:", url);
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
        script.defer = true;
        document.body.appendChild(script);

        script.onload = () => {
          console.log("[PinterestEmbed] Pinterest script loaded successfully");
          if (window.PinUtils) {
            window.PinUtils.build();
          }
        };

        script.onerror = () => {
          console.error("[PinterestEmbed] Failed to load Pinterest script");
          setEmbedFailed(true);
        };
      }
    }

    // Build Pinterest embeds after a short delay
    const timer = setTimeout(() => {
      if (window.PinUtils) {
        window.PinUtils.build();
        console.log("[PinterestEmbed] Pinterest embeds processed");
      } else {
        console.warn("[PinterestEmbed] PinUtils not available, showing fallback");
        setEmbedFailed(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [url]);

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
    <div ref={containerRef} className="pinterest-embed-container w-full flex justify-center">
      <a 
        data-pin-do="embedPin" 
        data-pin-width="large"
        href={url}
      />
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
