import { Skeleton } from "@/components/ui/skeleton";

interface EmbedSkeletonProps {
  platform?: string;
}

/** Platform-aware skeleton placeholder that mimics real embed layouts */
export const EmbedSkeleton = ({ platform }: EmbedSkeletonProps) => {
  switch (platform) {
    case 'youtube':
      return (
        <div className="w-full">
          <Skeleton className="w-full aspect-video rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      );

    case 'instagram':
      return (
        <div className="w-full">
          <div className="flex items-center gap-2 px-3 py-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="w-full aspect-square rounded-none" />
          <div className="flex gap-3 px-3 py-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
          <div className="px-3 pb-2 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      );

    case 'twitter':
    case 'x':
      return (
        <div className="w-full p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="w-full aspect-[16/10] rounded-xl" />
          <div className="flex gap-8 pt-1">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
        </div>
      );

    case 'spotify':
      return (
        <div className="w-full h-[352px] rounded-xl overflow-hidden">
          <Skeleton className="w-full h-full rounded-none" />
        </div>
      );

    case 'tiktok':
      return (
        <div className="w-full max-w-[325px] mx-auto">
          <Skeleton className="w-full aspect-[9/16] rounded-none" />
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      );

    case 'pinterest':
      return (
        <div className="w-full max-w-[500px] mx-auto">
          <Skeleton className="w-full aspect-[3/4] rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      );

    case 'reddit':
      return (
        <div className="w-full p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-5 w-4/5" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="flex gap-4 pt-1">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      );

    case 'facebook':
      return (
        <div className="w-full">
          <div className="flex items-center gap-2 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          <div className="px-3 pb-2 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="w-full aspect-[4/3] rounded-none" />
          <div className="flex justify-around p-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-10" />
          </div>
        </div>
      );

    case 'threads':
      return (
        <div className="w-full max-w-[540px] mx-auto p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="w-full aspect-[4/3] rounded-xl" />
        </div>
      );

    case 'linkedin':
      return (
        <div className="w-full h-[400px] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="w-full flex-1 min-h-[200px] rounded-none" />
        </div>
      );

    case 'medium':
    case 'quora':
    case 'blog':
      return (
        <div className="w-full p-4 space-y-3">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      );

    default:
      return (
        <div className="w-full">
          <Skeleton className="w-full aspect-video rounded-none" />
        </div>
      );
  }
};
