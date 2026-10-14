import { useEffect, useState, type RefObject } from "react";

interface Props {
  scrollRef: RefObject<HTMLDivElement>;
  platform: string;
  ready: boolean;
}

/** Read-only grid position; no activity recording or upload. */
export function PostRankDial({ scrollRef, platform, ready }: Props) {
  const [rank, setRank] = useState<number | undefined>();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ready) return;
    const updateRank = () => {
      const bounds = el.getBoundingClientRect();
      const middle = bounds.top + bounds.height / 2;
      let closestRank: number | undefined;
      let closestDistance = Infinity;
      el.querySelectorAll<HTMLElement>("[data-grid-rank]").forEach((post) => {
        const rect = post.getBoundingClientRect();
        const distance = rect.top <= middle && rect.bottom >= middle
          ? 0
          : Math.min(Math.abs(rect.top - middle), Math.abs(rect.bottom - middle));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestRank = Number(post.dataset.gridRank);
        }
      });
      setRank(closestRank);
    };
    updateRank();
    const tick = setInterval(updateRank, 200);
    return () => clearInterval(tick);
  }, [scrollRef, platform, ready]);

  if (!ready) return null;

  return (
    <div className="fixed right-2 top-1/2 -translate-y-1/2 z-[60] pointer-events-none">
      <div
        aria-label="Post rank tracker"
        className="h-11 w-11 rounded-full bg-foreground/80 text-background text-sm font-semibold shadow-lg grid place-items-center backdrop-blur-sm"
      >
        #{rank ?? "–"}
      </div>
    </div>
  );
}
