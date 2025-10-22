import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSpotifyEmbedUrl } from "@/lib/embedUtils";

interface SpotifyEmbedProps {
  url: string;
}

export const SpotifyEmbed = ({ url }: SpotifyEmbedProps) => {
  const embedUrl = getSpotifyEmbedUrl(url);

  if (!embedUrl) {
    return (
      <Card className="p-6 flex flex-col items-center gap-3 border-2">
        <ExternalLink className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="font-semibold mb-1">Spotify Content</p>
          <p className="text-sm text-muted-foreground mb-3">Listen on Spotify</p>
        </div>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open in Spotify
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden">
      <iframe
        src={embedUrl}
        width="100%"
        height="352"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title="Spotify player"
      />
    </div>
  );
};