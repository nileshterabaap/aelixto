import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getVimeoVideoId } from "@/lib/embedUtils";

interface VimeoEmbedProps {
  url: string;
}

export const VimeoEmbed = ({ url }: VimeoEmbedProps) => {
  const videoId = getVimeoVideoId(url);

  if (!videoId) {
    return (
      <Card className="p-6 flex flex-col items-center gap-3 border-2">
        <ExternalLink className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="font-semibold mb-1">Vimeo Video</p>
          <p className="text-sm text-muted-foreground mb-3">View this video on Vimeo</p>
        </div>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            View on Vimeo
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden aspect-video">
      <iframe
        src={`https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0`}
        className="w-full h-full"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title="Vimeo video"
      />
    </div>
  );
};