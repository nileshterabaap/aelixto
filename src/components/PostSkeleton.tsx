import { Skeleton } from "@/components/ui/skeleton";

export const PostSkeleton = () => {
  return (
    <div className="px-1">
        {/* Author Info Skeleton */}
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>

        {/* Content Skeleton */}
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />

        {/* Media Skeleton */}
        <Skeleton className="w-full aspect-video rounded-2xl mb-3" />

        {/* Title Skeleton */}
        <Skeleton className="h-6 w-2/3 mb-4" />

        {/* Actions Skeleton */}
        <div className="flex items-center justify-around px-2 py-4">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
    </div>
  );
};