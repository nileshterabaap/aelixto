import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { decodeHtmlEntities } from "@/lib/htmlEntities";

interface LitePreviewCardProps {
  url: string;
  title?: string | null;
  image?: string | null;
  text?: string | null;
  platform?: string;
  onLoadFull?: () => void;
}

export const LitePreviewCard = ({
  url,
  title,
  image,
  text,
  platform,
  onLoadFull
}: LitePreviewCardProps) => {
  const handleReadMore = () => {
    if (onLoadFull) {
      onLoadFull();
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Decode HTML entities for display
  const decodedTitle = title ? decodeHtmlEntities(title) : undefined;
  const decodedText = text ? decodeHtmlEntities(text) : undefined;

  return (
    <Card className="overflow-hidden border-2 border-border rounded-2xl hover:shadow-lg transition-shadow">
      {/* Image */}
      {image && (
        <div className="relative w-full aspect-video overflow-hidden">
          <img 
            src={image} 
            alt={decodedTitle || 'Preview'} 
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {platform && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-background/90 backdrop-blur-sm rounded-full text-xs font-medium border border-border">
              {platform}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {decodedTitle && (
          <h3 className="font-bold text-lg mb-2 line-clamp-2">
            {decodedTitle}
          </h3>
        )}
        
        {decodedText && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
            {decodedText}
          </p>
        )}

        {/* Read More Button */}
        <Button
          onClick={handleReadMore}
          variant="outline"
          size="sm"
          className="w-full group"
        >
          Read more
          <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </Card>
  );
};