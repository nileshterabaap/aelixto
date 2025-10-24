import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import pinterestIcon from "@/assets/pinterest-icon.png";

interface PinterestEmbedProps {
  url: string;
  mode?: 'preview' | 'embed';
  onOpen?: () => void;
}

interface PinData {
  title: string;
  author_name?: string;
  thumbnail_url?: string;
}

export const PinterestEmbed = ({ url, mode = 'preview', onOpen }: PinterestEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);
  const [pinData, setPinData] = useState<PinData | null>(null);

  useEffect(() => {
    const loadPinData = async () => {
      console.log("[PinterestEmbed] Loading Pinterest data for URL:", url);
      setIsLoading(true);
      
      let finalUrl = url;

      // If it's a pin.it short link, expand it first
      if (url.includes('pin.it/')) {
        console.log("[PinterestEmbed] Detected pin.it short link, expanding...");
        
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
          setIsLoading(false);
          return;
        }
      } else {
        setResolvedUrl(finalUrl);
      }

      // Validate Pinterest URL
      const isPinterestPin = /pinterest\.com\/pin\/[a-zA-Z0-9]+\/?/.test(finalUrl);
      if (!isPinterestPin) {
        console.warn("[PinterestEmbed] Invalid Pinterest pin URL:", finalUrl);
        setEmbedFailed(true);
        setIsLoading(false);
        return;
      }

      if (mode === 'preview') {
        // Fetch pin metadata using Pinterest oEmbed API
        try {
          const oembedUrl = `https://www.pinterest.com/oembed/?url=${encodeURIComponent(finalUrl)}`;
          const response = await fetch(oembedUrl);
          if (response.ok) {
            const data = await response.json();
            setPinData({
              title: data.title || 'Pinterest Pin',
              author_name: data.author_name,
              thumbnail_url: data.thumbnail_url
            });
            console.log("[PinterestEmbed] Fetched pin data:", data);
          } else {
            throw new Error('oEmbed fetch failed');
          }
        } catch (error) {
          console.warn("[PinterestEmbed] Failed to fetch pin metadata:", error);
          setEmbedFailed(true);
        }
        setIsLoading(false);
      } else {
        // Embed mode: load Pinterest script
        setIsLoading(false);
        
        if (!window.PinUtils) {
          const existingScript = document.querySelector('script[src="https://assets.pinterest.com/js/pinit.js"]');
          
          if (existingScript && 
              (existingScript.getAttribute('data-pin-hover') !== 'false' || 
               existingScript.getAttribute('data-pin-save') !== 'false')) {
            existingScript.remove();
          }
          
          if (!existingScript || 
              existingScript.getAttribute('data-pin-hover') !== 'false' || 
              existingScript.getAttribute('data-pin-save') !== 'false') {
            const script = document.createElement("script");
            script.src = "https://assets.pinterest.com/js/pinit.js";
            script.async = true;
            script.setAttribute('data-pin-hover', 'false');
            script.setAttribute('data-pin-save', 'false');
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
          setTimeout(() => {
            if (window.PinUtils) {
              window.PinUtils.build();
              console.log("[PinterestEmbed] Pinterest embeds processed");
            }
          }, 500);
        }
      }
    };

    loadPinData();
  }, [url, mode]);

  const handleCardClick = () => {
    window.open(resolvedUrl, '_blank');
    onOpen?.();
  };

  // Preview mode (default)
  if (mode === 'preview') {
    // Loading state
    if (isLoading) {
      return (
        <Card className="w-full max-w-[500px] mx-auto overflow-hidden">
          <Skeleton className="w-full aspect-[3/4]" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>
      );
    }

    // Error fallback
    if (embedFailed || !pinData) {
      return (
        <Card className="w-full max-w-[500px] mx-auto p-6 flex flex-col items-center gap-4">
          <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
          <p className="text-sm text-muted-foreground text-center">
            Unable to load Pinterest preview
          </p>
          <Button
            variant="outline"
            onClick={handleCardClick}
          >
            View on Pinterest
          </Button>
        </Card>
      );
    }

    // Clean preview card
    return (
      <Card 
        className="w-full max-w-[500px] mx-auto overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
        onClick={handleCardClick}
      >
        <div className="relative">
          {pinData.thumbnail_url ? (
            <img 
              src={pinData.thumbnail_url} 
              alt={pinData.title}
              className="w-full aspect-[3/4] object-cover"
            />
          ) : (
            <div className="w-full aspect-[3/4] bg-muted flex items-center justify-center">
              <img src={pinterestIcon} alt="Pinterest" className="w-16 h-16 opacity-50" />
            </div>
          )}
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-full p-2">
            <img src={pinterestIcon} alt="Pinterest" className="w-5 h-5" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          <h3 className="font-medium text-sm line-clamp-2 leading-snug">
            {pinData.title}
          </h3>
          {pinData.author_name && (
            <p className="text-xs text-muted-foreground">
              by {pinData.author_name}
            </p>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
          >
            View on Pinterest
          </Button>
        </div>
      </Card>
    );
  }

  // Embed mode (legacy iframe)
  if (isLoading) {
    return (
      <Card className="p-6 flex flex-col items-center gap-4">
        <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
        <p className="text-sm text-muted-foreground text-center">
          Loading Pinterest embed...
        </p>
      </Card>
    );
  }

  if (embedFailed) {
    return (
      <Card className="p-6 flex flex-col items-center gap-4">
        <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
        <p className="text-sm text-muted-foreground text-center">
          Unable to load Pinterest embed
        </p>
        <Button
          variant="outline"
          onClick={() => window.open(resolvedUrl, '_blank')}
        >
          View on Pinterest
        </Button>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-[500px] mx-auto">
      <div ref={containerRef} className="pinterest-embed-container w-full flex flex-col justify-center">
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
