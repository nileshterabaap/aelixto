import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";

/** True when the URL is an Instagram reel. */
export function isInstagramReelUrl(url?: string | null): boolean {
  if (!url) return false;
  return /instagram\.com/i.test(url) && /\/reels?\//i.test(url);
}

const REEL_AUDIO_NOTICE =
  "Instagram doesn't allow reels using its music library to play in other apps. Tap the Instagram icon to view it there.";

function InfoOverlay({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="About Instagram reel audio"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-foreground/70 p-1.5 text-background shadow-sm backdrop-blur-sm transition-transform active:scale-90"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div
          role="note"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-11 z-30 w-[min(320px,92%)] -translate-x-1/2 rounded-2xl border border-border bg-background/95 p-3 text-xs leading-relaxed text-foreground shadow-lg backdrop-blur-sm"
        >
          {REEL_AUDIO_NOTICE}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Overlays an "i" button on the top-centre of Instagram reel posts with a
 * note about Instagram's music-library audio restriction. Non-reel URLs
 * render children unchanged.
 */
export function InstagramReelInfo({ url, children }: { url?: string | null; children: ReactNode }) {
  if (!isInstagramReelUrl(url)) return <>{children}</>;
  return <InfoOverlay>{children}</InfoOverlay>;
}
