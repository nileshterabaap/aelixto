import { Skeleton } from "@/components/ui/skeleton";

export const SavedSkeleton = () => (
  <div className="container max-w-2xl mx-auto px-4 py-6">
    <Skeleton className="h-8 w-24 mb-4" />
    <Skeleton className="h-10 w-full rounded-xl mb-6" />
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-2xl" />
      ))}
    </div>
  </div>
);
