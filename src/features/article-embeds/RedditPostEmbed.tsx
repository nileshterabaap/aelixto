import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

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

  useEffect(() => {
    const fetchRedditEmbed = async () => {
      try {
        setIsLoading(true);
        // Use Reddit's oEmbed API to get the official embed
        const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        const data = await response.json();
        
        if (data.html) {
          setEmbedHtml(data.html);
        }
      } catch (error) {
        console.error('Failed to fetch Reddit embed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRedditEmbed();
  }, [url]);

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
      className="rounded-2xl overflow-hidden border-2 border-border bg-card"
      dangerouslySetInnerHTML={{ __html: embedHtml }}
    />
  );
};
