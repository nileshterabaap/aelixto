import { ExternalLink } from "lucide-react";

interface OgCardFallbackProps {
  url: string;
  title?: string;
  image?: string;
  description?: string;
  platform: 'instagram' | 'facebook' | 'unknown';
}

export const OgCardFallback = ({ url, title, image, description, platform }: OgCardFallbackProps) => {
  const platformName = platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : 'this platform';
  const displayTitle = title || `View on ${platformName}`;
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl overflow-hidden bg-muted border-2 border-border hover:border-foreground transition-colors"
    >
      {image && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img 
            src={image} 
            alt={displayTitle}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base line-clamp-2 mb-1">
              {displayTitle}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {description}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">
                {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
              </span>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
};
