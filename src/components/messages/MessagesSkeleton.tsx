import { Skeleton } from "@/components/ui/skeleton";

export const MessagesSkeleton = () => (
  <div className="space-y-1">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-3.5 w-48" />
        </div>
      </div>
    ))}
  </div>
);
