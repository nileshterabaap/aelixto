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
        {/* Content */}
        <div className="p-5 space-y-3">
          {/* Title */}
          <h3 className="text-xl font-bold leading-tight text-foreground line-clamp-2">
            {title}
          </h3>

          {/* Image */}
          {image && (
            <div className="relative w-full h-48 rounded-xl overflow-hidden bg-muted">
              <img
                src={image}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
                width="400"
                height="192"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-muted-foreground leading-relaxed line-clamp-3">
              {description}
            </p>
          )}

          {/* Site Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
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
            <ExternalLink className="h-3 w-3 ml-auto" />
          </div>
        </div>
      </a>
    </Card>
  );
};
