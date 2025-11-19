import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { decodeHtmlEntities } from "@/lib/htmlEntities";

interface OgCardFallbackProps {
  url: string;
  title?: string;
  image?: string;
  description?: string;
  platform: string;
}

export const OgCardFallback = ({ url, title, image, description, platform }: OgCardFallbackProps) => {
  // Decode HTML entities for display
  const decodedTitle = title ? decodeHtmlEntities(title) : undefined;
  const decodedDescription = description ? decodeHtmlEntities(description) : undefined;
  
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
              alt={decodedTitle || "Post preview"} 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base line-clamp-2 mb-1">
                {decodedTitle || "View on " + platform}
              </h3>
              {decodedDescription && (
                <p className="text-sm text-foreground/80 line-clamp-2 mb-2">
                  {decodedDescription}
                </p>
              )}
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
