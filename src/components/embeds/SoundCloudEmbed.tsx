import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SoundCloudEmbedProps {
  url: string;
}

export const SoundCloudEmbed = ({ url }: SoundCloudEmbedProps) => {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchEmbed = async () => {
      try {
        const response = await fetch(
          `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          // Extract iframe src from html
          const match = data.html.match(/src="([^"]+)"/);
          if (match) {
            setEmbedUrl(match[1]);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch SoundCloud embed:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchEmbed();
  }, [url]);

  if (loading) {
    return <div className="animate-pulse bg-muted rounded-2xl h-40" />;
  }

  if (error || !embedUrl) {
    return (
      <Card className="p-6 flex flex-col items-center gap-3 border-2">
        <ExternalLink className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="font-semibold mb-1">SoundCloud Track</p>
          <p className="text-sm text-muted-foreground mb-3">Listen on SoundCloud</p>
        </div>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Listen on SoundCloud
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden">
      <iframe
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={embedUrl}
        title="SoundCloud player"
      />
    </div>
  );
};