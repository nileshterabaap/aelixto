import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadScript } from "@/lib/embedUtils";

interface TikTokEmbedProps {
  url: string;
}

export const TikTokEmbed = ({ url }: TikTokEmbedProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const embedTikTok = async () => {
      try {
        await loadScript('https://www.tiktok.com/embed.js', 'tiktok-embed-script');
        
        if (containerRef.current && (window as any).TikTokEmbed) {
          (window as any).TikTokEmbed.init();
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load TikTok embed:', err);
        setError(true);
        setLoading(false);
      }
    };

    embedTikTok();
  }, [url]);

  if (error) {
    return (
      <Card className="p-6 flex flex-col items-center gap-3 border-2">
        <ExternalLink className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="font-semibold mb-1">TikTok Video</p>
          <p className="text-sm text-muted-foreground mb-3">View this video on TikTok</p>
        </div>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            View on TikTok
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex justify-center">
      {loading && (
        <div className="animate-pulse bg-muted rounded-2xl aspect-[9/16] w-full max-w-[325px]" />
      )}
      <div ref={containerRef}>
        <blockquote
          className="tiktok-embed"
          cite={url}
          data-video-id={url.split('/video/')[1]?.split('?')[0]}
          style={{ maxWidth: '325px', minWidth: '325px' }}
        >
          <section>
            <a target="_blank" rel="noopener noreferrer" href={url}>TikTok</a>
          </section>
        </blockquote>
      </div>
    </div>
  );
};