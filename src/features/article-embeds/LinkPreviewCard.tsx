import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";

interface LinkPreviewCardProps {
  url: string;
  title: string;
  description?: string;
  image?: string;
  domain: string;
  favicon?: string;
  siteName?: string;
}

export const LinkPreviewCard = ({
  url,
  title,
  description,
  image,
  domain,
  favicon,
  siteName,
}: LinkPreviewCardProps) => {
  return (
    <Card className="rounded-2xl overflow-hidden border border-border hover:shadow-lg transition-all">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {/* Thumbnail Image - displayed at the top */}
        {image && (
          <div className="relative w-full aspect-[16/9] bg-muted">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-3">
          {/* Site Info - at the top */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {favicon && (
              <img
                src={favicon}
                alt=""
                className="w-4 h-4 rounded"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <span className="font-medium truncate">
              {siteName || domain}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold leading-snug text-foreground line-clamp-2">
            {title}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {description}
            </p>
          )}

          {/* Read more link */}
          <div className="flex items-center gap-1 text-sm font-medium text-primary pt-1">
            <span>Read more</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>
      </a>
    </Card>
  );
};
