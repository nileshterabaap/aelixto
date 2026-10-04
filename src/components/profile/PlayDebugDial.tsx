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
import { allLifecycleFlags, getLifecycleFlags, setLifecycleFlags, type LifecycleFlag } from "@/lib/lifecycleFlags";

interface Props {
  scrollRef: RefObject<HTMLDivElement>;
  platform: string;
  ready: boolean;
}

/** Side dial showing the grid rank in view; tap to label + save diagnostics. */
const FLAG_LABELS: Array<[LifecycleFlag, string]> = [
  ["mute", "Mute off-screen"],
  ["freezePointer", "Freeze taps off-screen"],
  ["hardSuspend", "Sleep & reload"],
  ["exclusivePause", "Pause previous on play"],
  ["scrollFreeze", "Freeze taps while scrolling"],
];

export function PlayDebugDial({ scrollRef, platform, ready }: Props) {
  const [rank, setRank] = useState<number | undefined>();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ events: 0, labels: 0 });
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState(() => ({ ...getLifecycleFlags() }));
  const toggle = (k: LifecycleFlag, v: boolean) => { setLifecycleFlags({ [k]: v }); setFlags({ ...getLifecycleFlags() }); };
  const preset = (on: boolean) => { allLifecycleFlags(on); setFlags({ ...getLifecycleFlags() }); toast(on ? "All switches on" : "Pre-auto-pause mode"); };

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

  const label = (verdict: "worked" | "not_worked" | "not_loaded" | "frozen" | "buffered") => {
    if (rank == null) return;
    addDebugLabel(rank, verdict);
    setCounts(getDebugCounts());
    toast(`#${rank} marked: ${verdict === "worked" ? "Play worked" : verdict === "not_loaded" ? "Didn't load" : verdict === "frozen" ? "Stuck (icon only)" : verdict === "buffered" ? "Buffered then played" : "Not worked"}`);
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
          <button onClick={() => label("frozen")} className="w-full rounded-xl border border-destructive text-destructive text-sm py-2">
            Stuck (icon only)
          </button>
          <button onClick={() => label("buffered")} className="w-full rounded-xl border border-border text-foreground text-sm py-2">
            Buffered then played
          </button>
          <button onClick={() => label("not_loaded")} className="w-full rounded-xl border border-border bg-muted text-foreground text-sm py-2">
            Didn't load
          </button>
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-secondary text-secondary-foreground text-sm py-2">
            {saving ? "Saving…" : "Save records"}
          </button>
          <div className="pt-1 border-t border-border space-y-1">
            <div className="text-xs text-muted-foreground px-1">Test mode</div>
            {FLAG_LABELS.map(([key, text]) => (
              <label key={key} className="flex items-center justify-between text-xs px-1">
                <span>{text}</span>
                <input type="checkbox" checked={flags[key]} onChange={(e) => toggle(key, e.target.checked)} />
              </label>
            ))}
            <div className="flex gap-1">
              <button onClick={() => preset(false)} className="flex-1 rounded-lg border border-border text-xs py-1">Pre-auto-pause</button>
              <button onClick={() => preset(true)} className="flex-1 rounded-lg border border-border text-xs py-1">All on</button>
            </div>
          </div>
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
