import { useEffect, useState } from "react";
import pinterestIcon from "@/assets/platforms/pinterest.svg";
import { usePersistEmbedHeight } from "@/hooks/usePersistEmbedHeight";

interface PinterestEmbedProps {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}

// Extract Pinterest Pin ID from URL
const extractPinId = (url: string): string | null => {
  // Pattern: /pin/123456789/
  const pinMatch = url.match(/\/pin\/(\d+)/);
  if (pinMatch) return pinMatch[1];
  return null;
};

const PIN_MIN_HEIGHT = 320;
const PIN_MAX_HEIGHT = 1400;
const PIN_DEFAULT_HEIGHT = 600;

const clampPin = (h: number) =>
  Math.min(PIN_MAX_HEIGHT, Math.max(PIN_MIN_HEIGHT, Math.round(h)));

export const PinterestEmbed = ({ url, postId, suggestedHeight }: PinterestEmbedProps) => {
  const [resolvedUrl, setResolvedUrl] = useState(url);
  const [pinId, setPinId] = useState<string | null>(extractPinId(url));
  const [loading, setLoading] = useState(!pinId); // Only loading if we need to expand URL
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeHeight, setIframeHeight] = useState<number>(() =>
    suggestedHeight && suggestedHeight >= PIN_MIN_HEIGHT
      ? clampPin(suggestedHeight)
      : PIN_DEFAULT_HEIGHT
  );
  const persistHeight = usePersistEmbedHeight(postId);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const origin = event.origin || "";
      if (!origin.includes("pinterest.com")) return;
      const data: any = event.data;
      let h: number | null = null;
      if (typeof data === "number") h = data;
      else if (data && typeof data === "object") {
        if (typeof data.height === "number") h = data.height;
        else if (typeof data?.data?.height === "number") h = data.data.height;
      } else if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed?.height === "number") h = parsed.height;
        } catch {
          // ignore
        }
      }
      if (!h || h < PIN_MIN_HEIGHT) return;
      const clamped = clampPin(h);
      setIframeHeight((prev) => (Math.abs(prev - clamped) > 4 ? clamped : prev));
      persistHeight(clamped);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [persistHeight]);

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
          style={{ height: iframeHeight }}
        >
          {!iframeLoaded && (
            <div className="absolute inset-0 animate-pulse bg-muted" />
          )}
          <iframe
            src={`https://assets.pinterest.com/ext/embed.html?id=${pinId}`}
            width="100%"
            height={iframeHeight}
            frameBorder="0"
            scrolling="no"
            allowFullScreen
            style={{
              border: 'none',
              display: 'block',
              width: '100%',
              height: '100%',
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
