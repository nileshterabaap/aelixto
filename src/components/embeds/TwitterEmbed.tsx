import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { loadTwitterEmbed } from "@/lib/ScriptLoader";
import { trackVideoPlayBeacon } from "@/hooks/useViewTracking";

interface TwitterEmbedProps {
  url: string;
  postId?: string | null;
  authorUserId?: string | null;
  onOriginalTap?: () => void;
  onOriginalVisit?: () => void;
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void;
        createTweet: (
          tweetId: string,
          container: HTMLElement,
          options?: any
        ) => Promise<HTMLElement | undefined>;
      };
      events?: {
        bind: (eventName: string, handler: (event: any) => void) => void;
        unbind?: (eventName: string, handler: (event: any) => void) => void;
      };
    };
  }
}

const extractTweetId = (url: string): string | null => {
  const patterns = [
    /twitter\.com\/\w+\/status\/(\d+)/,
    /x\.com\/\w+\/status\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const TwitterEmbed = ({ url, postId, authorUserId, onOriginalTap, onOriginalVisit }: TwitterEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playTrackedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const trackXPlay = useCallback(() => {
    if (!postId || playTrackedRef.current) return;
    playTrackedRef.current = true;
    trackVideoPlayBeacon(postId, authorUserId).catch(() => {
      playTrackedRef.current = false;
    });
  }, [postId, authorUserId]);

  useEffect(() => {
    playTrackedRef.current = false;
  }, [url, postId]);

  useEffect(() => {
    let twitterClickHandler: ((event: any) => void) | null = null;

    const loadEmbed = async () => {
      try {
        const tweetId = extractTweetId(url);
        
        if (!tweetId) {
          setError(true);
          setLoading(false);
          return;
        }

        await loadTwitterEmbed();

        if (containerRef.current && window.twttr) {
          containerRef.current.innerHTML = "";
          
          const tweet = await window.twttr.widgets.createTweet(
            tweetId,
            containerRef.current,
            {
              theme: document.documentElement.classList.contains("dark")
                ? "dark"
                : "light",
              align: "center",
            }
          );

          if (!tweet) {
            setError(true);
          } else {
            if (window.twttr?.events?.bind) {
              twitterClickHandler = (event: any) => {
                const target = event?.target;
                if (target instanceof Node && containerRef.current?.contains(target)) {
                  trackXPlay();
                }
              };
              window.twttr.events.bind('click', twitterClickHandler);
            }

            // Dispatch a custom event so HydratedFeedPost can detect readiness
            // immediately without waiting for MutationObserver cycles
            containerRef.current?.dispatchEvent(
              new CustomEvent('embedReady', { bubbles: true })
            );
          }
        }
      } catch (err) {
        console.error("[TwitterEmbed] Failed to load Twitter embed:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadEmbed();

    return () => {
      if (twitterClickHandler && window.twttr?.events?.unbind) {
        window.twttr.events.unbind('click', twitterClickHandler);
      }
    };
  }, [url, trackXPlay]);

  if (error) {
    return (
      <div data-embed-status="ready">
        <Card className="p-6 text-center space-y-3">
          <div className="flex justify-center">
            <svg
              className="w-12 h-12 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            Unable to load this post
          </p>
          <Button variant="outline" size="sm" asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!onOriginalTap) return;
                event.preventDefault();
                onOriginalTap();
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on X
            </a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="relative"
      data-embed-status={loading ? 'loading' : 'ready'}
      onPointerDownCapture={trackXPlay}
      onTouchStartCapture={trackXPlay}
      onFocusCapture={trackXPlay}
    >
      {loading && (
        <div className="rounded-2xl overflow-hidden bg-muted animate-pulse aspect-[4/3]" />
      )}
      <div ref={containerRef} className="twitter-embed-container" />
      <style>{`
        .twitter-embed-container iframe {
          margin-bottom: -85px !important;
        }
        .twitter-embed-container {
          overflow: hidden;
          max-height: calc(100% - 85px);
        }
      `}</style>
    </div>
  );
};
