import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  clearFlickerCapture,
  subscribeFlicker,
  summarizeFlicker,
  type FlickerEvent,
} from "@/lib/flickerDebug";

/**
 * DEBUG ONLY — shows what happened around the link-box close so we can
 * identify the flicker's cause. Native builds only. Remove after diagnosis.
 */
export const FlickerDebugPanel = () => {
  const [events, setEvents] = useState<FlickerEvent[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => subscribeFlicker((e, r) => {
    setEvents(e);
    setRunning(r);
  }), []);

  if (!Capacitor.isNativePlatform()) return null;
  if (events.length === 0) return null;

  return (
    <div
      className="fixed left-2 right-2 bottom-2 z-[9999] max-h-[45vh] overflow-auto rounded-lg border border-border bg-background/95 p-2 text-[10px] leading-tight shadow-lg"
      style={{ pointerEvents: "auto" }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold">
          DEBUG ONLY · flicker {running ? "recording…" : "captured"}
        </span>
        <button
          className="rounded bg-muted px-2 py-0.5 font-medium"
          onClick={clearFlickerCapture}
        >
          Close
        </button>
      </div>
      <div className="mb-1 rounded bg-muted p-1 font-semibold">
        Likely cause: {summarizeFlicker(events)}
      </div>
      <div className="space-y-0.5 font-mono">
        {events.map((e, i) => (
          <div key={i}>
            <span className="text-muted-foreground">{String(e.t).padStart(4, " ")}ms</span>{" "}
            <span className="font-semibold">{e.kind}</span> {e.detail}
          </div>
        ))}
      </div>
    </div>
  );
};
