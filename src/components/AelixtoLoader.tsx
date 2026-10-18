import { cn } from "@/lib/utils";
import "./AelixtoLoader.css";

interface AelixtoLoaderProps {
  size?: number;
  className?: string;
  /** When true, fades the loader out (used when content is ready). */
  done?: boolean;
}

/**
 * Morphing Aelixto logo loader — two overlapping rounded squares (blue + orange-outlined)
 * that rotate in opposite directions and gently pulse, matching the brand mark.
 * Renders on a fully transparent background so it can sit on top of any surface.
 * When `done` becomes true, the loader smoothly fades away.
 */
export const AelixtoLoader = ({ size = 72, className, done = false }: AelixtoLoaderProps) => {
  return (
    <div
      className={cn(
        "aelixto-loader inline-flex items-center justify-center transition-opacity duration-500 ease-out",
        done ? "opacity-0" : "opacity-100",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    >
      <span className="aelixto-loader-layer aelixto-loader-blue" aria-hidden="true">
        <svg viewBox="0 0 100 100">
        {/* Blue rounded square — rotates clockwise */}
          <rect
            x="18"
            y="18"
            width="52"
            height="52"
            rx="14"
            ry="14"
            fill="none"
            stroke="hsl(var(--brand-blue))"
            strokeWidth="6"
            transform="rotate(45 44 44)"
          />
        </svg>
      </span>
      <span className="aelixto-loader-layer aelixto-loader-orange" aria-hidden="true">
        <svg viewBox="0 0 100 100">
        {/* Orange rounded square — rotates counter-clockwise */}
          <rect
            x="30"
            y="30"
            width="52"
            height="52"
            rx="14"
            ry="14"
            fill="none"
            stroke="hsl(var(--brand-orange))"
            strokeWidth="4"
            transform="rotate(45 56 56)"
          />
        </svg>
      </span>
    </div>
  );
};

export default AelixtoLoader;