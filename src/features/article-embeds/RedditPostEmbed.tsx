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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRedditEmbed = async () => {
      try {
        setIsLoading(true);
        
        // Load Reddit embed script first
        await loadRedditEmbed();
        
        // Use Reddit's oEmbed API to get the official embed
        const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        const embedData = await response.json();
        
        if (embedData.html) {
          setEmbedHtml(embedData.html);
        }
      } catch (error) {
        console.error('Failed to fetch Reddit embed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRedditEmbed();
  }, [url]);

  // Process Reddit embeds after HTML is inserted
  useEffect(() => {
    if (embedHtml && containerRef.current) {
      // Reddit's embed script looks for blockquote elements with class "reddit-embed-bq"
      // and transforms them into interactive embeds
      const processEmbeds = () => {
        if ((window as any).redditembed) {
          (window as any).redditembed.init();
        }
      };
      
      // Small delay to ensure DOM is ready
      setTimeout(processEmbeds, 100);
    }
  }, [embedHtml]);

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
