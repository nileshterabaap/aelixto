import { AelixtoLoader } from "@/components/AelixtoLoader";

export const PostSkeleton = () => {
  // Match the profile grid thumbnail transition exactly: a single rounded
  // muted card with a soft white shimmer sweep. No multi-part bars.
  return (
    <div
      data-testid="post-skeleton"
      className="relative overflow-hidden rounded-[2rem] bg-muted/70 h-[420px] w-full before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:animate-shimmer"
      style={{ backgroundSize: "1000px 100%" }}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AelixtoLoader size={72} />
      </div>
    </div>
  );
};