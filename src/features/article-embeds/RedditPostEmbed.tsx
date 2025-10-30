import { useEffect, useState, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { loadRedditEmbed } from "@/lib/ScriptLoader";

interface RedditPostEmbedProps {
  url: string;
  data: {
    meta: {
      title: string;
    };
  };
}

export const RedditPostEmbed = ({ url, data }: RedditPostEmbedProps) => {
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initAttempted = useRef(false);

  useEffect(() => {
    const fetchRedditEmbed = async () => {
      try {
        setIsLoading(true);
        setError(false);
        
        // Load Reddit embed script first
        await loadRedditEmbed();
        
        // Use Reddit's oEmbed API to get the official embed
        const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        
        if (!response.ok) {
          throw new Error('Failed to fetch embed');
        }
        
        const embedData = await response.json();
        
        if (embedData.html) {
          // Extract just the blockquote from the HTML (remove script tags)
          const parser = new DOMParser();
          const doc = parser.parseFromString(embedData.html, 'text/html');
          const blockquote = doc.querySelector('blockquote.reddit-embed-bq');
          
          if (blockquote) {
            setEmbedHtml(blockquote.outerHTML);
          } else {
            setEmbedHtml(embedData.html);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Reddit embed:', error);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRedditEmbed();
    initAttempted.current = false;
  }, [url]);

  // Process Reddit embeds after HTML is inserted
  useEffect(() => {
    if (embedHtml && containerRef.current && !initAttempted.current) {
      initAttempted.current = true;
      
      // Reddit's embed script looks for blockquote elements with class "reddit-embed-bq"
      // and transforms them into interactive embeds
      const processEmbeds = () => {
        if ((window as any).redditembed) {
          try {
            (window as any).redditembed.init();
            console.log('[RedditEmbed] Initialized Reddit embed for:', url);
          } catch (e) {
            console.error('[RedditEmbed] Error initializing:', e);
          }
        } else {
          console.warn('[RedditEmbed] redditembed not available');
        }
      };
      
      // Multiple attempts with different delays to ensure it catches
      setTimeout(processEmbeds, 100);
      setTimeout(processEmbeds, 500);
      setTimeout(processEmbeds, 1000);
    }
  }, [embedHtml, url]);

  if (isLoading) {
    return (
      <div className="rounded-2xl overflow-hidden border-2 border-border bg-card">
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!embedHtml) {
    return (
      <div className="rounded-2xl overflow-hidden border-2 border-border bg-card p-4">
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {data.meta.title || 'View post on Reddit'}
        </a>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="rounded-2xl overflow-hidden border-2 border-border bg-card"
      dangerouslySetInnerHTML={{ __html: embedHtml }}
    />
  );
};
