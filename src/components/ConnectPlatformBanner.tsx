import { X } from 'lucide-react';
import { memo } from 'react';

interface ConnectPlatformBannerProps {
  platform: string;
  platformDisplayName: string;
  onDismiss: (platform: string) => void;
  onConnect: (platform: string) => void;
}

const platformColors: Record<string, string> = {
  youtube: 'bg-red-500/10 text-red-600 border-red-500/20',
  instagram: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  tiktok: 'bg-foreground/5 text-foreground border-foreground/10',
  twitter: 'bg-foreground/5 text-foreground border-foreground/10',
  x: 'bg-foreground/5 text-foreground border-foreground/10',
  facebook: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  reddit: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  pinterest: 'bg-red-600/10 text-red-700 border-red-600/20',
  spotify: 'bg-green-500/10 text-green-600 border-green-500/20',
  quora: 'bg-red-500/10 text-red-600 border-red-500/20',
  medium: 'bg-foreground/5 text-foreground border-foreground/10',
};

export const ConnectPlatformBanner = memo(({
  platform,
  platformDisplayName,
  onDismiss,
  onConnect,
}: ConnectPlatformBannerProps) => {
  const colorClass = platformColors[platform.toLowerCase()] || 'bg-muted text-foreground border-border';

  return (
    <div className="mx-5 mb-2 flex items-center gap-1.5">
      <button
        onClick={() => onConnect(platform)}
        className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${colorClass} hover:opacity-80 transition-opacity`}
        style={{ borderWidth: 0, backgroundColor: 'hsl(var(--foreground) / 0.12)', color: 'hsl(var(--foreground))' }}
      >
        Connect {platformDisplayName}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(platform);
        }}
        className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors text-muted-foreground"
        aria-label={`Dismiss connect ${platformDisplayName}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});

ConnectPlatformBanner.displayName = 'ConnectPlatformBanner';
