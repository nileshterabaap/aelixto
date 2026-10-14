import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const KEY = "aelixto-score-info-dismissed";

/** Small "i" next to the Aelix Score. Once tapped, it disappears forever after the user leaves the page. */
export const AelixScoreInfo = () => {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  const tapped = useRef(false);
  const location = useLocation();
  const startPath = useRef(location.pathname);

  useEffect(() => {
    if (tapped.current && location.pathname !== startPath.current) setHidden(true);
  }, [location.pathname]);

  if (hidden) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="What is Aelix Score?"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border-2 border-foreground flex items-center justify-center active:scale-90 transition-transform"
          onClick={() => {
            tapped.current = true;
            try { localStorage.setItem(KEY, "1"); } catch {}
          }}
        >
          <Info className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" side="bottom">
        Your Aelix Score grows when people view, play, and visit the original of your posts. You can hide it anytime in Edit Profile.
      </PopoverContent>
    </Popover>
  );
};
