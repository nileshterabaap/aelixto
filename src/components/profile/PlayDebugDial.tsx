import { useEffect, useState, type RefObject } from "react";
import { toast } from "sonner";
import {
  addDebugLabel,
  currentRank,
  getDebugCounts,
  saveDebugSession,
  startPlayDebug,
  stopPlayDebug,
} from "@/lib/playDebugRecorder";

interface Props {
  scrollRef: RefObject<HTMLDivElement>;
  platform: string;
  ready: boolean;
}

/** Side dial showing the grid rank in view; tap to label + save diagnostics. */
export function PlayDebugDial({ scrollRef, platform, ready }: Props) {
  const [rank, setRank] = useState<number | undefined>();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ events: 0, labels: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !ready) return;
    startPlayDebug(el, platform);
    const tick = setInterval(() => setRank(currentRank()), 200);
    return () => { clearInterval(tick); stopPlayDebug(); };
  }, [scrollRef, platform, ready]);

  useEffect(() => {
    if (open) setCounts(getDebugCounts());
  }, [open]);

  const label = (verdict: "worked" | "not_worked" | "not_loaded") => {
    if (rank == null) return;
    addDebugLabel(rank, verdict);
    setCounts(getDebugCounts());
    toast(`#${rank} marked: ${verdict === "worked" ? "Play worked" : verdict === "not_loaded" ? "Didn't load" : "Not worked"}`);
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    const res = await saveDebugSession();
    setSaving(false);
    if (res.ok) toast.success("Records saved");
    else toast.error(res.error || "Couldn't save");
    setOpen(false);
  };

  if (!ready) return null;

  return (
    <div className="fixed right-2 top-1/2 -translate-y-1/2 z-[60] flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg p-2 w-44 space-y-1.5">
          <div className="text-xs text-muted-foreground px-1">
            Post #{rank ?? "–"} · {counts.labels} labels
          </div>
          <button onClick={() => label("worked")} className="w-full rounded-xl bg-primary text-primary-foreground text-sm py-2">
            Play worked
          </button>
          <button onClick={() => label("not_worked")} className="w-full rounded-xl bg-destructive text-destructive-foreground text-sm py-2">
            Not worked
          </button>
          <button onClick={() => label("not_loaded")} className="w-full rounded-xl border border-border bg-muted text-foreground text-sm py-2">
            Didn't load
          </button>
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-secondary text-secondary-foreground text-sm py-2">
            {saving ? "Saving…" : "Save records"}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Post rank tracker"
        className="h-11 w-11 rounded-full bg-foreground/80 text-background text-sm font-semibold shadow-lg grid place-items-center backdrop-blur-sm"
      >
        #{rank ?? "–"}
      </button>
    </div>
  );
}
