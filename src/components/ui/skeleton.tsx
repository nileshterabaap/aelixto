import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/50",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-muted before:to-transparent",
        "before:animate-shimmer",
        className
      )}
      style={{
        backgroundSize: "1000px 100%",
      }}
      {...props}
    />
  );
}

export { Skeleton };
