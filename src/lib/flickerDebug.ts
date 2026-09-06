/**
 * TEMPORARY DIAGNOSTIC — link-box (CreatePostDialog) close flicker.
 *
 * Records everything that happens in a short window around the dialog close
 * so we can see WHAT repaints/relayouts/remounts at the moment the flicker
 * is visible. Remove this file (and FlickerDebugPanel) once diagnosed.
 */

export type FlickerEvent = {
  t: number; // ms since capture start
  kind: string;
  detail: string;
};

type Listener = (events: FlickerEvent[], running: boolean) => void;

const WINDOW_MS = 3000;

let events: FlickerEvent[] = [];
let start = 0;
let running = false;
const listeners = new Set<Listener>();
let cleanups: Array<() => void> = [];

const emit = () => listeners.forEach((l) => l([...events], running));

const push = (kind: string, detail: string) => {
  if (!running) return;
  events.push({ t: Math.round(performance.now() - start), kind, detail });
  if (events.length > 400) events.shift();
  emit();
};

export const subscribeFlicker = (l: Listener) => {
  listeners.add(l);
  l([...events], running);
  return () => listeners.delete(l);
};

const describe = (n: Node): string => {
  if (!(n instanceof Element)) return n.nodeName;
  const cls = (n.getAttribute("class") || "").split(/\s+/).slice(0, 3).join(".");
  return `${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""}${cls ? "." + cls : ""}`;
};

/** Call right when the dialog begins to close. */
export const startFlickerCapture = (reason: string) => {
  stopCapture();
  events = [];
  start = performance.now();
  running = true;
  push("start", reason);

  // 1. Frame timing — a flicker is almost always one or more dropped frames.
  let last = performance.now();
  let raf = 0;
  const tick = () => {
    const now = performance.now();
    const delta = now - last;
    last = now;
    if (delta > 32) push("long-frame", `${Math.round(delta)}ms dropped frame`);
    if (now - start < WINDOW_MS) raf = requestAnimationFrame(tick);
    else finish();
  };
  raf = requestAnimationFrame(tick);
  cleanups.push(() => cancelAnimationFrame(raf));

  // 2. DOM mutations on body: portals unmounting, Radix scroll-lock styles,
  //    class/style flips that force a repaint.
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") {
        const el = r.target as Element;
        push(
          "attr",
          `${describe(el)} [${r.attributeName}] -> ${(
            el.getAttribute(r.attributeName || "") || ""
          ).slice(0, 60)}`
        );
      } else {
        r.removedNodes.forEach((n) => push("removed", describe(n)));
        r.addedNodes.forEach((n) => push("added", describe(n)));
      }
    }
  });
  mo.observe(document.body, {
    attributes: true,
    attributeFilter: ["style", "class", "data-state", "aria-hidden"],
    childList: true,
    subtree: false,
  });
  cleanups.push(() => mo.disconnect());

  // Also watch <html> (scroll lock / kb-open live there).
  const moHtml = new MutationObserver((records) =>
    records.forEach((r) =>
      push(
        "html-attr",
        `[${r.attributeName}] -> ${(
          document.documentElement.getAttribute(r.attributeName || "") || ""
        ).slice(0, 60)}`
      )
    )
  );
  moHtml.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  cleanups.push(() => moHtml.disconnect());

  // 3. Layout shifts — names the exact element that jumped.
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.entryType === "layout-shift" && entry.value > 0.0005) {
          const src = (entry.sources || [])
            .map((s: any) => (s.node ? describe(s.node) : "?"))
            .slice(0, 3)
            .join(", ");
          push("layout-shift", `${entry.value.toFixed(4)} from ${src || "unknown"}`);
        } else if (entry.entryType === "longtask") {
          push("long-task", `${Math.round(entry.duration)}ms JS block`);
        }
      }
    });
    po.observe({ entryTypes: ["layout-shift", "longtask"] as any });
    cleanups.push(() => po.disconnect());
  } catch {
    /* not supported */
  }

  // 4. Embed iframes reloading behind the dialog (classic flicker source).
  const iframeCount = () => document.querySelectorAll("iframe").length;
  let prevIframes = iframeCount();
  push("iframes", `${prevIframes} present at close`);
  const iframeTimer = window.setInterval(() => {
    const n = iframeCount();
    if (n !== prevIframes) {
      push("iframes", `${prevIframes} -> ${n} (embed remount)`);
      prevIframes = n;
    }
  }, 50);
  cleanups.push(() => clearInterval(iframeTimer));

  // 5. Viewport / keyboard / scroll movement.
  const vv = window.visualViewport;
  const onVV = () =>
    push("viewport", `vv=${Math.round(vv?.height || 0)} inner=${window.innerHeight}`);
  vv?.addEventListener("resize", onVV);
  cleanups.push(() => vv?.removeEventListener("resize", onVV));

  let prevScroll = window.scrollY;
  const onScroll = () => {
    if (Math.abs(window.scrollY - prevScroll) > 2) {
      push("scroll", `${Math.round(prevScroll)} -> ${Math.round(window.scrollY)}`);
      prevScroll = window.scrollY;
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener("scroll", onScroll));

  const kbVar = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--kb").trim();
  let prevKb = kbVar();
  const kbTimer = window.setInterval(() => {
    const v = kbVar();
    if (v !== prevKb) {
      push("--kb", `${prevKb || "0px"} -> ${v || "0px"}`);
      prevKb = v;
    }
  }, 50);
  cleanups.push(() => clearInterval(kbTimer));

  const onVis = () => push("visibility", document.visibilityState);
  document.addEventListener("visibilitychange", onVis);
  cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
};

const stopCapture = () => {
  cleanups.forEach((c) => {
    try {
      c();
    } catch {
      /* noop */
    }
  });
  cleanups = [];
};

const finish = () => {
  running = false;
  stopCapture();
  push("end", "capture window closed");
  running = false;
  emit();
};

export const clearFlickerCapture = () => {
  stopCapture();
  running = false;
  events = [];
  emit();
};

/** Best-guess cause, ranked by how strongly each signal explains a flash. */
export const summarizeFlicker = (evs: FlickerEvent[]): string => {
  const after = evs.filter((e) => e.t > 60);
  const iframe = after.find((e) => e.kind === "iframes" && e.detail.includes("->"));
  if (iframe) return `Embeds remounting behind the dialog (${iframe.detail}) at ${iframe.t}ms`;
  const shift = after
    .filter((e) => e.kind === "layout-shift")
    .sort((a, b) => parseFloat(b.detail) - parseFloat(a.detail))[0];
  if (shift) return `Layout shift ${shift.detail} at ${shift.t}ms`;
  const frame = after
    .filter((e) => e.kind === "long-frame")
    .sort((a, b) => parseInt(b.detail) - parseInt(a.detail))[0];
  if (frame && parseInt(frame.detail) > 80)
    return `Dropped frame ${frame.detail} at ${frame.t}ms (compositing/repaint)`;
  const attr = after.find((e) => e.kind === "html-attr" || e.kind === "attr");
  if (attr) return `Style/class flip: ${attr.detail} at ${attr.t}ms`;
  return "No strong signal captured — flicker may be a pure GPU compositing flash";
};
