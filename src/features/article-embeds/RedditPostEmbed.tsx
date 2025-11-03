import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RedditPostEmbedProps {
  url: string;
  data: {
    meta: {
      title: string;
    };
  };
}

export const RedditPostEmbed = ({ url, data }: RedditPostEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Load Reddit embed script
    if (!scriptLoadedRef.current) {
      const script = document.createElement('script');
      script.src = 'https://embed.redditmedia.com/widgets/platform.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
      scriptLoadedRef.current = true;

      return () => {
        // Cleanup if component unmounts
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card">
      <div ref={containerRef} className="p-4">
        <blockquote 
          className="reddit-card" 
          data-card-created={Date.now()}
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            {data.meta.title || ''}
          </a>
        </blockquote>
      </div>
    </div>
  );
};
