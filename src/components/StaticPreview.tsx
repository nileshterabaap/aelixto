import { memo, useState, useCallback } from 'react';
import { Play, ExternalLink } from 'lucide-react';

interface StaticPreviewProps {
  thumbnailUrl?: string | null;
  aspectRatio: string;
  rendererKind: string;
  platform?: string | null;
  title?: string | null;
  onActivate: () => void;
}

/**
 * Static-first embed preview: renders a thumbnail in a fixed aspect-ratio container
 * with a tap-to-activate overlay. Zero external JS, zero iframes, zero layout shift.
 */
export const StaticPreview = memo(({
  thumbnailUrl,
  aspectRatio,
  rendererKind,
  platform,
  title,
  onActivate,
}: StaticPreviewProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = useCallback(() => {
    onActivate();
  }, [onActivate]);

  // Determine overlay type
  const isVideo = rendererKind === 'video';
  const isInteractive = ['twitter', 'reddit', 'pinterest', 'universal', 'raw', 'article'].includes(rendererKind);
  const showOverlay = isVideo || isInteractive;

  // If no thumbnail and no meaningful content, show minimal placeholder
  if (!thumbnailUrl || imageError) {
    return (
      <div
        className="relative w-full bg-muted cursor-pointer"
        style={{ aspectRatio }}
        onClick={handleClick}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          {isVideo ? (
            <Play className="w-12 h-12 opacity-40" />
          ) : (
            <ExternalLink className="w-10 h-10 opacity-40" />
          )}
          {title && (
            <p className="text-sm font-medium text-center px-6 line-clamp-2 opacity-60">
              {title}
            </p>
          )}
          <span className="text-xs opacity-40">Tap to load</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full bg-muted cursor-pointer overflow-hidden"
      style={{ aspectRatio }}
      onClick={handleClick}
    >
      {/* Thumbnail image */}
      <img
        src={thumbnailUrl}
        alt={title || 'Content preview'}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        loading="eager"
        decoding="async"
      />

      {/* Shimmer while loading */}
      {!imageLoaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Activation overlay */}
      {showOverlay && imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110">
            {isVideo ? (
              <Play className="w-7 h-7 text-white fill-white ml-0.5" />
            ) : (
              <ExternalLink className="w-6 h-6 text-white" />
            )}
          </div>
        </div>
      )}
    </div>
  );
});

StaticPreview.displayName = 'StaticPreview';
