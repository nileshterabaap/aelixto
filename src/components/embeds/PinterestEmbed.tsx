import { useEffect, useState } from "react";
import pinterestIcon from "@/assets/platforms/pinterest.svg";

interface PinterestEmbedProps {
  url: string;
}

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [pinImage, setPinImage] = useState<string | null>(null);
  const [pinTitle, setPinTitle] = useState<string>("");
  const [pinDescription, setPinDescription] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPin = async () => {
      let finalUrl = url;

      // If it's a pin.it short link, expand it first
      if (url.includes('pin.it/')) {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data, error } = await supabase.functions.invoke('expand-pin', {
            body: { url }
          });
          if (!error && data?.finalUrl) {
            finalUrl = data.finalUrl;
            setResolvedUrl(finalUrl);
          }
        } catch {
          // Use original URL
        }
      }

      // Fetch pin metadata using Pinterest oEmbed API
      try {
        const oembedUrl = `https://www.pinterest.com/oembed/?url=${encodeURIComponent(finalUrl)}`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.title) setPinTitle(data.title);
          if (data.description) setPinDescription(data.description);
          // oEmbed returns the pin image in the url field or we can extract from html
          if (data.url) {
            setPinImage(data.url);
          } else if (data.thumbnail_url) {
            setPinImage(data.thumbnail_url);
          }
        }
      } catch {
        // Non-critical
      }

      setLoading(false);
    };

    loadPin();
  }, [url]);

  if (loading) {
    return (
      <div className="w-full animate-pulse bg-muted rounded-xl" style={{ aspectRatio: '3/4', maxWidth: 500, margin: '0 auto' }} />
    );
  }

  return (
    <div 
      className="rounded-xl overflow-hidden border border-border bg-card cursor-pointer hover:opacity-95 transition-opacity max-w-[500px] mx-auto"
      onClick={() => window.open(resolvedUrl, '_blank', 'noopener,noreferrer')}
    >
      {pinImage && (
        <img 
          src={pinImage} 
          alt={pinTitle || "Pinterest pin"} 
          className="w-full h-auto object-cover"
          loading="eager"
          decoding="async"
        />
      )}
      <div className="flex items-center gap-3 p-3">
        <img src={pinterestIcon} alt="Pinterest" className="w-6 h-6 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {pinTitle && <p className="text-sm font-medium text-foreground line-clamp-2">{pinTitle}</p>}
          {pinDescription && !pinTitle && <p className="text-sm text-muted-foreground line-clamp-2">{pinDescription}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">View on Pinterest</p>
        </div>
      </div>
    </div>
  );
};
