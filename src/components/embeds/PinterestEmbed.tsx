import { useEffect, useState } from "react";
import pinterestIcon from "@/assets/platforms/pinterest.svg";

interface PinterestEmbedProps {
  url: string;
}

// Extract Pinterest Pin ID from URL
const extractPinId = (url: string): string | null => {
  // Pattern: /pin/123456789/
  const pinMatch = url.match(/\/pin\/(\d+)/);
  if (pinMatch) return pinMatch[1];
  return null;
};

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [pinId, setPinId] = useState<string | null>(extractPinId(url));
  const [loading, setLoading] = useState(!pinId); // Only loading if we need to expand URL
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    // If we already have a pin ID, no need to expand
    if (pinId) {
      setLoading(false);
      return;
    }

    const expandUrl = async () => {
      // If it's a pin.it short link, expand it first
      if (url.includes('pin.it/')) {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const { data, error } = await supabase.functions.invoke('expand-pin', {
            body: { url }
          });
          if (!error && data?.finalUrl) {
            setResolvedUrl(data.finalUrl);
            const id = extractPinId(data.finalUrl);
            if (id) {
              setPinId(id);
            }
          }
        } catch {
          // Fall through to link-only mode
        }
      }
      setLoading(false);
    };

    expandUrl();
  }, [url, pinId]);

  if (loading) {
    return (
      <div
        className="w-full animate-pulse bg-muted rounded-xl"
        data-embed-status="loading"
        style={{ aspectRatio: '3/4', maxWidth: 500, margin: '0 auto' }}
      />
    );
  }

  // If we have a pin ID, use Pinterest's native embed iframe (supports video playback)
  if (pinId) {
    return (
      <div className="w-full" data-embed-status={iframeLoaded ? 'ready' : 'loading'}>
        <div
          className="relative w-full overflow-hidden bg-muted"
          style={{ minHeight: 400 }}
        >
          {!iframeLoaded && (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          )}
          <iframe
            src={`https://assets.pinterest.com/ext/embed.html?id=${pinId}`}
            width="100%"
            height="600"
            frameBorder="0"
            scrolling="no"
            allowFullScreen
            style={{
              border: 'none',
              display: 'block',
              width: '100%',
              opacity: iframeLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
        <div
          className="flex items-center gap-3 p-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => window.open(resolvedUrl, '_blank', 'noopener,noreferrer')}
        >
          <img src={pinterestIcon} alt="Pinterest" className="w-6 h-6 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">View on Pinterest</p>
        </div>
      </div>
    );
  }

  // Fallback: no pin ID extracted, show a link
  return (
    <div data-embed-status="ready">
      <div 
        className="rounded-xl overflow-hidden border border-border bg-card cursor-pointer hover:opacity-95 transition-opacity max-w-[500px] mx-auto p-4"
        onClick={() => window.open(resolvedUrl, '_blank', 'noopener,noreferrer')}
      >
        <div className="flex items-center gap-3">
          <img src={pinterestIcon} alt="Pinterest" className="w-6 h-6 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">View on Pinterest</p>
        </div>
      </div>
    </div>
  );
};
