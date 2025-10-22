import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface RedditEmbedProps {
  url: string;
}

export const RedditEmbed = ({ url }: RedditEmbedProps) => {
  // Reddit doesn't have a great public embed API, so we'll use their embed URL
  const embedUrl = url.endsWith('/') ? `${url}embed` : `${url}/embed`;

  return (
    <div className="w-full">
      <iframe
        src={embedUrl}
        className="w-full min-h-[400px] border-2 rounded-2xl"
        sandbox="allow-scripts allow-same-origin allow-popups"
        title="Reddit post"
      />
      <Card className="mt-2 p-3 flex items-center justify-between border-2">
        <p className="text-sm text-muted-foreground">Reddit Post</p>
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            View on Reddit
          </a>
        </Button>
      </Card>
    </div>
  );
};