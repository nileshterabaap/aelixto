import { ReactNode } from "react";

interface MediaFrameProps {
  platform?: string;
  children: ReactNode;
}

/**
 * Stable-height container that reserves space before embeds load,
 * preventing layout shifts during SDK rendering.
 */
export const MediaFrame = ({ platform, children }: MediaFrameProps) => {
  const p = (platform || "").toLowerCase();

  // Platform-specific aspect ratios
  const aspectClass =
    p === "youtube"
      ? "aspect-video"
      : p === "tiktok"
        ? "aspect-[9/16] max-w-[325px] mx-auto"
        : p === "spotify"
          ? "h-[352px]"
          : p === "twitter" || p === "x"
            ? "aspect-[4/5]"
            : p === "reddit"
              ? "aspect-[4/5]"
              : p === "pinterest"
                ? "aspect-[3/4] max-w-[500px] mx-auto"
                : p === "medium" || p === "quora" || p === "blog"
                  ? "h-[200px]"
                  : "aspect-[4/5]"; // default for instagram, threads, facebook, linkedin, etc.

  return (
    <div className={`media-frame ${aspectClass}`}>
      {children}
    </div>
  );
};
