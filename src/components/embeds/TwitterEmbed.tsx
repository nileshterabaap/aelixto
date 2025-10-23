import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface TwitterEmbedProps {
  url: string;
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
    };
  }
}

const loadTwitterScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (window.twttr) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Twitter script"));
    document.body.appendChild(script);
  });
};

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

export const TwitterEmbed = ({ url }: TwitterEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadEmbed = async () => {
      console.log('[TwitterEmbed] Loading tweet from URL:', url);
      try {
        const tweetId = extractTweetId(url);
        console.log('[TwitterEmbed] Extracted tweet ID:', tweetId);
        
        if (!tweetId) {
          console.error('[TwitterEmbed] Failed to extract tweet ID from URL');
          setError(true);
          setLoading(false);
          return;
        }

        console.log('[TwitterEmbed] Loading Twitter script...');
        await loadTwitterScript();
        console.log('[TwitterEmbed] Twitter script loaded successfully');

        if (containerRef.current && window.twttr) {
          containerRef.current.innerHTML = "";
          console.log('[TwitterEmbed] Creating tweet widget...');
          
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
            console.error('[TwitterEmbed] Failed to create tweet widget');
            setError(true);
          } else {
            console.log('[TwitterEmbed] Tweet widget created successfully');
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
  }, [url]);

  if (error) {
    return (
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
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="rounded-2xl overflow-hidden bg-muted animate-pulse aspect-[4/3]" />
      )}
      <div ref={containerRef} className="twitter-embed-container" />
    </div>
  );
};
