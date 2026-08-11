import { cn } from "@/lib/utils";

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
        "inline-flex items-center justify-center transition-opacity duration-500 ease-out",
        done ? "opacity-0" : "opacity-100",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="aelixto-loader-svg"
        style={{ overflow: "visible" }}
      >
        {/* Blue rounded square — rotates clockwise */}
        <g className="aelixto-loader-blue" style={{ transformOrigin: "50px 50px" }}>
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
        </g>
        {/* Orange rounded square — rotates counter-clockwise */}
        <g className="aelixto-loader-orange" style={{ transformOrigin: "50px 50px" }}>
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
        </g>
      </svg>

      <style>{`
        @keyframes aelixto-spin-cw {
          0%   { transform: rotate(0deg)   scale(1); }
          50%  { transform: rotate(180deg) scale(0.9); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes aelixto-spin-ccw {
          0%   { transform: rotate(0deg)    scale(1); }
          50%  { transform: rotate(-180deg) scale(1.1); }
          100% { transform: rotate(-360deg) scale(1); }
        }
        .aelixto-loader-blue {
          animation: aelixto-spin-cw 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .aelixto-loader-orange {
          animation: aelixto-spin-ccw 2.4s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .aelixto-loader-blue, .aelixto-loader-orange {
            animation-duration: 6s;
          }
        }
      `}</style>
    </div>
  );
};

export default AelixtoLoader;