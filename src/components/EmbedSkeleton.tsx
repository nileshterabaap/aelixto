interface EmbedSkeletonProps {
  platform?: string;
}

/**
 * Unified embed placeholder — same treatment as the profile grid thumbnail:
 * a muted rounded block with a soft white shimmer sweep. Aspect ratio is
 * tuned per-platform so the reserved space feels natural before the real
 * media resolves in.
 */
export const EmbedSkeleton = ({ platform }: EmbedSkeletonProps) => {
  // Per-platform aspect ratio so the reserved area doesn't jolt when the
  // real media replaces it. Everything else is identical to the grid.
  const aspectClass = (() => {
    switch (platform) {
      case 'youtube':
        return 'aspect-video';
      case 'instagram':
        return 'aspect-square';
      case 'tiktok':
        return 'aspect-[9/16]';
      case 'pinterest':
        return 'aspect-[3/4]';
      case 'spotify':
        return 'h-[352px]';
      case 'linkedin':
        return 'h-[400px]';
      case 'facebook':
      case 'threads':
        return 'aspect-[4/3]';
      case 'twitter':
      case 'x':
        return 'aspect-[16/10]';
      case 'reddit':
      case 'medium':
      case 'quora':
      case 'blog':
        return 'h-[220px]';
      default:
        return 'aspect-video';
    }
  })();

  return (
    <div
      className={`relative w-full overflow-hidden bg-muted/70 ${aspectClass} before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer`}
      style={{ backgroundSize: '1000px 100%' }}
    />
  );
};
