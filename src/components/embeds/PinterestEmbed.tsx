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

      // Fetch pin metadata via our edge function (avoids CORS issues with direct Pinterest API)
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: ogData, error: ogError } = await supabase.functions.invoke('fetch-og', {
          body: { url: finalUrl }
        });
        if (!ogError && ogData) {
          const title = ogData.meta?.title || ogData.title || '';
          const description = ogData.meta?.description || ogData.description || '';
          const image = ogData.meta?.image || ogData.image || '';
          if (title) setPinTitle(title);
          if (description) setPinDescription(description);
          if (image) setPinImage(image);
        }
      } catch {
        // Non-critical — will show "View on Pinterest" link
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
