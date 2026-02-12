import { X } from 'lucide-react';
import { memo } from 'react';

interface ConnectPlatformBannerProps {
  platform: string;
  platformDisplayName: string;
  onDismiss: (platform: string) => void;
  onConnect: (platform: string) => void;
}

const platformColors: Record<string, string> = {
  youtube: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  instagram: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  tiktok: 'bg-foreground/5 text-foreground border-foreground/10',
  twitter: 'bg-foreground/5 text-foreground border-foreground/10',
  x: 'bg-foreground/5 text-foreground border-foreground/10',
  facebook: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  reddit: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  pinterest: 'bg-red-600/10 text-red-700 dark:text-red-400 border-red-600/20',
  spotify: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  quora: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
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
    <div className={`flex items-center gap-2 mx-5 mb-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${colorClass}`}>
      <button
        onClick={() => onConnect(platform)}
        className="flex-1 text-left truncate hover:underline"
      >
        Connect {platformDisplayName}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(platform);
        }}
        className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
        aria-label={`Dismiss connect ${platformDisplayName}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});

ConnectPlatformBanner.displayName = 'ConnectPlatformBanner';
