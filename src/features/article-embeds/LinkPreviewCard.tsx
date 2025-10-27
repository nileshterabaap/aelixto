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
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Site Name */}
              <div className="flex items-center gap-2 mb-2">
                {favicon && (
                  <img
                    src={favicon}
                    alt=""
                    className="w-4 h-4 rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <span className="text-xs text-muted-foreground font-medium">
                  {siteName || domain}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-semibold text-base line-clamp-2 mb-1">
                {title}
              </h3>

              {/* Description */}
              {description && (
                <p className="text-sm text-foreground/80 line-clamp-2 mb-2">
                  {description}
                </p>
              )}

              {/* Domain */}
              <p className="text-sm text-muted-foreground truncate">{domain}</p>
            </div>
            <ExternalLink className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </div>
      </a>
    </Card>
  );
};
