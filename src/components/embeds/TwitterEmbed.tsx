import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { loadTwitterEmbed } from "@/lib/ScriptLoader";

interface TwitterEmbedProps {
  url: string;
  fallbackText?: string | null;
  authorName?: string | null;
  username?: string | null;
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

const trimFallbackText = (text?: string | null) => {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 220 ? `${clean.slice(0, 219).trimEnd()}…` : clean;
};

export const TwitterEmbed = ({ url, fallbackText, authorName, username }: TwitterEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fallbackReady, setFallbackReady] = useState(false);
  const [renderedEmbed, setRenderedEmbed] = useState(false);

  const dispatchReady = () => {
    containerRef.current?.dispatchEvent(
      new CustomEvent('embedReady', { bubbles: true })
    );
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setFallbackReady(false);
    setRenderedEmbed(false);

    const fallbackTimer = window.setTimeout(() => {
      if (cancelled) return;
      setFallbackReady(true);
      dispatchReady();
    }, 1800);

    const loadEmbed = async () => {
      try {
        const tweetId = extractTweetId(url);
        
        if (!tweetId) {
          window.clearTimeout(fallbackTimer);
          setError(true);
          setLoading(false);
          dispatchReady();
          return;
        }

        await loadTwitterEmbed();

        if (!cancelled && containerRef.current && window.twttr?.widgets?.createTweet) {
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

          if (cancelled) return;
          if (!tweet) {
            setError(true);
          } else {
            setRenderedEmbed(true);
            window.clearTimeout(fallbackTimer);
            dispatchReady();
          }
        }
      } catch (err) {
        console.error("[TwitterEmbed] Failed to load Twitter embed:", err);
        if (!cancelled) {
          setFallbackReady(true);
          dispatchReady();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadEmbed();
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [url]);

  const text = trimFallbackText(fallbackText);
  const handle = username?.replace(/^@/, "");
  const status = error || fallbackReady || renderedEmbed || !loading ? 'ready' : 'loading';

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
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              View on X
            </a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative" data-embed-status={status}>
      {loading && !fallbackReady && !renderedEmbed && (
        <div className="rounded-2xl overflow-hidden bg-muted animate-pulse aspect-[4/3]" />
      )}
      {fallbackReady && !renderedEmbed && !error && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl border bg-card p-5 no-underline text-card-foreground"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold leading-tight truncate">{authorName || handle || 'Post on X'}</p>
              {handle && <p className="text-sm text-muted-foreground truncate">@{handle}</p>}
            </div>
            <svg className="h-8 w-8 shrink-0 text-foreground" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
            </svg>
          </div>
          {text && <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap">{text}</p>}
          <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            <span>View on X</span>
          </div>
        </a>
      )}
      <div ref={containerRef} className={renderedEmbed ? "twitter-embed-container" : "twitter-embed-container hidden"} />
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
