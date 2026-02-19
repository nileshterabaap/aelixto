import { Skeleton } from "@/components/ui/skeleton";

interface EmbedSkeletonProps {
  platform?: string;
}

/** Platform-aware skeleton placeholder for embeds */
export const EmbedSkeleton = ({ platform }: EmbedSkeletonProps) => {
  // Adjust aspect ratio / height based on platform
  const getSkeletonStyle = () => {
    switch (platform) {
      case 'youtube':
        return 'aspect-video';
      case 'instagram':
        return 'aspect-[3/4]';
      case 'twitter':
      case 'x':
        return 'aspect-[4/3]';
      case 'spotify':
        return 'h-[352px]';
      case 'tiktok':
        return 'aspect-[9/16] max-w-[325px] mx-auto';
      case 'pinterest':
        return 'aspect-[3/4] max-w-[500px] mx-auto';
      case 'reddit':
        return 'aspect-[4/3]';
      case 'tiktok':
        return 'aspect-[9/16] max-w-[325px] mx-auto';
      case 'facebook':
        return 'aspect-[4/3]';
      case 'threads':
        return 'aspect-[3/4] max-w-[540px] mx-auto';
      case 'linkedin':
        return 'h-[400px]';
      case 'medium':
      case 'quora':
      case 'blog':
        return 'h-[200px]';
      default:
        return 'aspect-video';
    }
  };

  return (
    <div className={`w-full rounded-none overflow-hidden ${getSkeletonStyle()}`}>
      <Skeleton className="w-full h-full rounded-none" />
    </div>
  );
};
