import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadScript, getTwitterPostId } from "@/lib/embedUtils";

interface TwitterEmbedProps {
  url: string;
}

export const TwitterEmbed = ({ url }: TwitterEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const postId = getTwitterPostId(url);

  useEffect(() => {
    if (!postId) {
      setError(true);
      setLoading(false);
      return;
    }

    const embedTweet = async () => {
      try {
        await loadScript('https://platform.twitter.com/widgets.js', 'twitter-embed-script');
        
        if (containerRef.current && (window as any).twttr) {
          containerRef.current.innerHTML = '';
          await (window as any).twttr.widgets.createTweet(postId, containerRef.current, {
            align: 'center',
            theme: 'light',
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load Twitter embed:', err);
        setError(true);
        setLoading(false);
      }
    };

    embedTweet();
  }, [url, postId]);

  if (error || !postId) {
    return (
      <Card className="p-6 flex flex-col items-center gap-3 border-2">
        <ExternalLink className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="font-semibold mb-1">Twitter Post</p>
          <p className="text-sm text-muted-foreground mb-3">View this post on Twitter</p>
        </div>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            View on Twitter
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div className="w-full">
      {loading && (
        <div className="animate-pulse bg-muted rounded-2xl h-64" />
      )}
      <div ref={containerRef} className="twitter-embed-container" />
    </div>
  );
};