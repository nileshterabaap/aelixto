import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";

interface OgCardFallbackProps {
  url: string;
  title?: string;
  image?: string;
  platform: string;
}

export const OgCardFallback = ({ url, title, image, platform }: OgCardFallbackProps) => {
  return (
    <Card className="overflow-hidden border-2 border-border hover:border-primary/50 transition-colors">
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block"
      >
        {image && (
          <div className="aspect-video w-full overflow-hidden bg-muted">
            <img 
              src={image} 
              alt={title || "Post preview"} 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base line-clamp-2 mb-1">
                {title || "View on " + platform}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {new URL(url).hostname}
              </p>
            </div>
            <ExternalLink className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </div>
      </a>
    </Card>
  );
};
