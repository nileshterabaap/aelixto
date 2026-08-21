import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
// Read-only reuse of the PRODUCTION embed-src builder. Production code is untouched.
import { buildThreadsEmbedSrc, isThreadsUrl } from "@/components/embeds/ThreadsEmbed";

type Entry = {
  t: number;
  wall: string;
  category: string;
  event: string;
  observation: string;
  /** DIRECT = directly observed, INFERRED, or XORIGIN = not observable */
  kind: "DIRECT" | "INFERRED" | "XORIGIN";
  data?: unknown;
};

const MAX_UI_ROWS = 300;

const fmt = (n: number) => `${n.toFixed(2)}ms`;

const rectOf = (el: Element | null) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
};

const styleOf = (el: Element | null) => {
  if (!el) return null;
  const s = getComputedStyle(el);
  return {
    display: s.display,
    visibility: s.visibility,
    opacity: s.opacity,
    position: s.position,
    zIndex: s.zIndex,
    overflow: s.overflow,
    transform: s.transform,
    pointerEvents: s.pointerEvents,
    background: s.backgroundColor,
    backgroundImage: s.backgroundImage,
  };
};

const describeEl = (el: Element | null) =>
  el
    ? {
        tag: el.tagName,
        id: (el as HTMLElement).id || null,
        cls: typeof el.className === "string" ? el.className.slice(0, 120) : null,
        rect: rectOf(el),
        z: getComputedStyle(el).zIndex,
        pe: getComputedStyle(el).pointerEvents,
      }
    : null;

const ThreadsVideoDiagnostic = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [tracing, setTracing] = useState(false);
  const [rows, setRows] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const traceRef = useRef<Entry[]>([]);
  const startRef = useRef<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tracingRef = useRef(false);
  const lastLayoutRef = useRef<string>("");
  const loadTimeRef = useRef<number | null>(null);
  const overlayHitsRef = useRef<number>(0);
  const sizeChangesRef = useRef<number>(0);

  const log = useCallback(
    (category: string, event: string, observation: string, kind: Entry["kind"] = "DIRECT", data?: unknown) => {
      if (!tracingRef.current) return;
      const e: Entry = {
        t: performance.now() - startRef.current,
        wall: new Date().toISOString(),
        category,
        event,
        observation,
        kind,
        data,
      };
      traceRef.current.push(e);
      setRows((prev) => {
        const next = prev.length >= MAX_UI_ROWS ? prev.slice(prev.length - MAX_UI_ROWS + 1) : prev.slice();
        next.push(e);
        return next;
      });
    },
    []
  );

  const env = useMemo(() => {
    const cap = (window as any).Capacitor;
    return {
      userAgent: navigator.userAgent,
      platform: (navigator as any).platform ?? null,
      vendor: navigator.vendor ?? null,
      devicePixelRatio: window.devicePixelRatio,
      screen: { w: screen.width, h: screen.height, availW: screen.availWidth, availH: screen.availHeight },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      capacitorPlatform: cap?.getPlatform?.() ?? "web (no Capacitor)",
      isNative: !!cap?.isNativePlatform?.(),
      webview: /wv\)/.test(navigator.userAgent)
        ? "Android WebView (wv token present)"
        : /Chrome\//.test(navigator.userAgent)
        ? "Chrome-family browser"
        : "unknown",
      visibilityState: document.visibilityState,
    };
  }, []);

  // ---- observers, attached once an iframe exists and tracing is on ----
  useEffect(() => {
    if (!tracing || !embedSrc) return;
    const host = hostRef.current;
    if (!host) return;

    const cleanups: Array<() => void> = [];

    const snapshotLayout = (why: string) => {
      const el = iframeRef.current;
      if (!el) return;
      const rect = rectOf(el);
      const st = styleOf(el);
      const key = JSON.stringify([rect, st]);
      if (key !== lastLayoutRef.current) {
        if (lastLayoutRef.current) sizeChangesRef.current += 1;
        lastLayoutRef.current = key;
        log("LAYOUT", why, `w=${rect?.w} h=${rect?.h} x=${rect?.x} y=${rect?.y} vis=${st?.visibility} op=${st?.opacity} z=${st?.zIndex} tf=${st?.transform}`, "DIRECT", {
          rect,
          style: st,
          connected: el.isConnected,
        });
      }
    };

    // B — creation snapshot
    log("IFRAME", "created+inserted", `src=${embedSrc}`, "DIRECT", { src: embedSrc, connected: !!iframeRef.current?.isConnected });
    snapshotLayout("initial");

    // C — mutation observer on host subtree
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") {
          log("MUTATION", `attr:${r.attributeName}`, `${(r.target as Element).tagName} changed ${r.attributeName}`, "DIRECT", {
            target: describeEl(r.target as Element),
          });
        } else {
          log("MUTATION", "childList", `+${r.addedNodes.length} / -${r.removedNodes.length} under ${(r.target as Element).tagName}`, "DIRECT", {
            added: Array.from(r.addedNodes).map((n) => (n as Element).nodeName),
            removed: Array.from(r.removedNodes).map((n) => (n as Element).nodeName),
          });
        }
        snapshotLayout("mutation");
      }
    });
    mo.observe(host, { attributes: true, childList: true, subtree: true, attributeFilter: ["style", "class", "src", "hidden"] });
    cleanups.push(() => mo.disconnect());

    // ResizeObserver
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        log("RESIZE", "resizeobserver", `${(e.target as Element).tagName} -> ${Math.round(e.contentRect.width)}x${Math.round(e.contentRect.height)}`, "DIRECT");
      }
      snapshotLayout("resize");
    });
    ro.observe(host);
    if (iframeRef.current) ro.observe(iframeRef.current);
    cleanups.push(() => ro.disconnect());

    // D — intersection
    if (iframeRef.current) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            log(
              "INTERSECTION",
              "change",
              `isIntersecting=${e.isIntersecting} ratio=${e.intersectionRatio.toFixed(3)}`,
              "DIRECT",
              { boundingClientRect: e.boundingClientRect.toJSON?.() ?? null, rootBounds: e.rootBounds?.toJSON?.() ?? null }
            );
          }
        },
        { threshold: [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1] }
      );
      io.observe(iframeRef.current);
      cleanups.push(() => io.disconnect());
    }

    // D — document/window events
    const onVis = () => log("VISIBILITY", "visibilitychange", `state=${document.visibilityState} hidden=${document.hidden}`);
    const onFocus = () => log("WINDOW", "focus", `activeElement=${document.activeElement?.tagName}`);
    const onBlur = () =>
      log(
        "WINDOW",
        "blur",
        `activeElement=${document.activeElement?.tagName}${document.activeElement === iframeRef.current ? " (THE THREADS IFRAME)" : ""}`,
        document.activeElement === iframeRef.current ? "INFERRED" : "DIRECT"
      );
    const onPageHide = () => log("WINDOW", "pagehide", "page hidden");
    const onPageShow = () => log("WINDOW", "pageshow", "page shown");
    const onResizeWin = () => {
      log("WINDOW", "resize", `viewport=${window.innerWidth}x${window.innerHeight}`);
      snapshotLayout("window-resize");
    };
    const onOrient = () => log("WINDOW", "orientationchange", `${(screen as any).orientation?.type ?? "unknown"}`);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("resize", onResizeWin);
    window.addEventListener("orientationchange", onOrient);
    cleanups.push(() => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("resize", onResizeWin);
      window.removeEventListener("orientationchange", onOrient);
    });

    // I — user interaction (capture, passive, non-intrusive)
    const inBounds = (x: number, y: number) => {
      const r = iframeRef.current?.getBoundingClientRect();
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const mkPointer = (name: string) => (ev: Event) => {
      const pe = ev as PointerEvent | TouchEvent;
      const pt =
        "clientX" in pe
          ? { x: (pe as PointerEvent).clientX, y: (pe as PointerEvent).clientY }
          : (pe as TouchEvent).touches?.[0]
          ? { x: (pe as TouchEvent).touches[0].clientX, y: (pe as TouchEvent).touches[0].clientY }
          : null;
      log("INTERACTION", name, pt ? `at (${Math.round(pt.x)},${Math.round(pt.y)}) insideIframe=${inBounds(pt.x, pt.y)}` : "no coords");
      if (pt) hitTest(`after:${name}`, pt.x, pt.y);
    };
    const handlers: Array<[string, EventListener]> = [
      ["pointerdown", mkPointer("pointerdown")],
      ["pointerup", mkPointer("pointerup")],
      ["click", mkPointer("click")],
      ["touchstart", mkPointer("touchstart")],
      ["touchend", mkPointer("touchend")],
    ];
    handlers.forEach(([n, h]) => window.addEventListener(n, h, { capture: true, passive: true }));
    cleanups.push(() => handlers.forEach(([n, h]) => window.removeEventListener(n, h, { capture: true } as any)));

    // H — error capture
    const onErr = (e: ErrorEvent) =>
      log("ERROR", "window.error", `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`, "DIRECT", { stack: e.error?.stack ?? null, scope: "Aelixto parent page" });
    const onRej = (e: PromiseRejectionEvent) =>
      log("ERROR", "unhandledrejection", String((e.reason as any)?.message ?? e.reason), "DIRECT", { scope: "Aelixto parent page" });
    const onResErr = (e: Event) => {
      const t = e.target as Element;
      if (!t || !("tagName" in t)) return;
      log("ERROR", "resource", `${t.tagName} failed: ${(t as any).src ?? (t as any).href ?? "?"}`, "DIRECT", {
        scope: t === iframeRef.current ? "iframe-related (observable)" : "unknown / possibly cross-origin",
      });
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    window.addEventListener("error", onResErr, true);
    cleanups.push(() => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
      window.removeEventListener("error", onResErr, true);
    });

    // G — resource timing
    const RES_RE = /(threads\.net|threads\.com|instagram|cdninstagram|fbcdn|scontent)/i;
    const reportEntries = (entries: PerformanceEntryList) => {
      entries.forEach((raw) => {
        const e = raw as PerformanceResourceTiming;
        if (!RES_RE.test(e.name)) return;
        log("RESOURCE", e.initiatorType || "resource", `${e.name.slice(0, 140)} start=${e.startTime.toFixed(1)} dur=${e.duration.toFixed(1)} transfer=${e.transferSize}`, "DIRECT", {
          url: e.name,
          initiatorType: e.initiatorType,
          startTime: e.startTime,
          duration: e.duration,
          transferSize: e.transferSize,
          encodedBodySize: e.encodedBodySize,
          decodedBodySize: e.decodedBodySize,
          note:
            e.transferSize === 0
              ? "sizes may be 0 due to cross-origin Timing-Allow-Origin restrictions (NOT a failure signal)"
              : undefined,
        });
      });
    };
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((list) => reportEntries(list.getEntries()));
      po.observe({ type: "resource", buffered: true });
      cleanups.push(() => po?.disconnect());
    } catch {
      log("RESOURCE", "unsupported", "PerformanceObserver('resource') unavailable in this engine", "XORIGIN");
    }
    log(
      "RESOURCE",
      "scope-note",
      "Only resources fetched by the PARENT document are visible. Requests made INSIDE the cross-origin Threads iframe (including the .mp4/poster) are NOT observable.",
      "XORIGIN"
    );

    // E — rAF sampling for 12s
    let rafId = 0;
    const rafStart = performance.now();
    let lastSample = 0;
    const tick = () => {
      const now = performance.now();
      if (now - lastSample > 250) {
        lastSample = now;
        snapshotLayout("raf-sample");
      }
      if (now - rafStart < 12000 && tracingRef.current) rafId = requestAnimationFrame(tick);
      else log("PAINT", "raf-window-end", "stopped rAF sampling after 12s", "DIRECT");
    };
    rafId = requestAnimationFrame(tick);
    cleanups.push(() => cancelAnimationFrame(rafId));

    // F — periodic hit testing
    const hitTimer = window.setInterval(() => hitTest("periodic"), 1000);
    cleanups.push(() => clearInterval(hitTimer));
    hitTest("pre-load");

    return () => cleanups.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracing, embedSrc]);

  // F — hit test helper
  const hitTest = useCallback(
    (why: string, px?: number, py?: number) => {
      const el = iframeRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = px ?? r.left + r.width / 2;
      const y = py ?? r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      const stack = (document.elementsFromPoint?.(x, y) ?? []).slice(0, 6);
      const isTop = top === el;
      const coveringIdx = stack.findIndex((e) => e === el);
      if (!isTop && coveringIdx > 0) overlayHitsRef.current += 1;
      log(
        "HIT TEST",
        why,
        isTop
          ? "iframe is topmost element at test point"
          : `TOPMOST IS NOT THE IFRAME -> <${top?.tagName}> class="${typeof top?.className === "string" ? top.className.slice(0, 60) : ""}"`,
        "DIRECT",
        { point: { x: Math.round(x), y: Math.round(y) }, top: describeEl(top), stack: stack.map(describeEl) }
      );
    },
    [log]
  );

  const start = () => {
    const raw = url.trim();
    if (!raw) return;
    if (!isThreadsUrl(raw)) {
      toast({ title: "Not a Threads URL", description: "Enter a canonical https://www.threads.net/@user/post/... URL", variant: "destructive" });
      return;
    }
    const src = buildThreadsEmbedSrc(raw);
    if (!src) {
      toast({ title: "Cannot build /embed URL", description: "This looks like a /share/... link. Paste the canonical post URL.", variant: "destructive" });
      return;
    }
    traceRef.current = [];
    setRows([]);
    setSummary(null);
    lastLayoutRef.current = "";
    loadTimeRef.current = null;
    overlayHitsRef.current = 0;
    sizeChangesRef.current = 0;
    startRef.current = performance.now();
    tracingRef.current = true;
    setTracing(true);
    setEmbedSrc(null);
    // A — input
    setTimeout(() => {
      log("INPUT", "load-pressed", `entered=${raw}`, "DIRECT", { entered: raw, normalized: raw, embedSrc: src });
      log("ENV", "environment", `${env.webview} | cap=${env.capacitorPlatform} | dpr=${env.devicePixelRatio}`, "DIRECT", env);
      log("INPUT", "embed-src", src, "DIRECT");
      setEmbedSrc(src);
    }, 0);
  };

  const stop = () => {
    tracingRef.current = false;
    setTracing(false);
    setSummary(buildSummary());
  };

  const buildSummary = () => {
    const all = traceRef.current;
    const res = all.filter((e) => e.category === "RESOURCE" && e.kind === "DIRECT" && e.event !== "scope-note");
    const errs = all.filter((e) => e.category === "ERROR");
    const overlay = all.filter((e) => e.category === "HIT TEST" && e.observation.startsWith("TOPMOST IS NOT"));
    const inter = all.filter((e) => e.category === "INTERSECTION").slice(-1)[0];
    const lay = all.filter((e) => e.category === "LAYOUT").slice(-1)[0];
    const mut = all.filter((e) => e.category === "MUTATION");
    return [
      "THREADS VIDEO DIAGNOSTIC SUMMARY",
      "",
      "ENVIRONMENT",
      `- Runtime: ${env.webview} (Capacitor: ${env.capacitorPlatform}${env.isNative ? ", native" : ""})`,
      `- User-Agent: ${env.userAgent}`,
      `- Viewport: ${env.viewport.w}x${env.viewport.h}  DPR: ${env.devicePixelRatio}  Screen: ${env.screen.w}x${env.screen.h}`,
      "",
      "1. IFRAME LOADING  [DIRECTLY OBSERVED]",
      `- embed src: ${embedSrc}`,
      `- load event fired: ${loadTimeRef.current !== null ? `yes @ ${fmt(loadTimeRef.current)}` : "NO"}`,
      `- iframe error event: ${all.some((e) => e.event === "iframe-error") ? "yes" : "no"}`,
      "",
      "2. RESOURCE LOADING  [PARENT-OBSERVABLE ONLY]",
      `- Threads/Meta resources visible to the parent document: ${res.length}`,
      ...res.slice(0, 25).map((e) => `  * ${(e.data as any)?.url?.slice(0, 160)} (${(e.data as any)?.initiatorType}, ${((e.data as any)?.duration ?? 0).toFixed(1)}ms, transfer=${(e.data as any)?.transferSize})`),
      "- NOT OBSERVABLE — CROSS-ORIGIN: any request issued inside the Threads document (poster image, .mp4/DASH segments, decoder init).",
      "",
      "3. LAYOUT / VISIBILITY  [DIRECTLY OBSERVED]",
      `- final layout: ${lay?.observation ?? "n/a"}`,
      `- distinct layout/style changes recorded: ${sizeChangesRef.current}`,
      `- last intersection: ${inter?.observation ?? "n/a"}`,
      `- DOM mutations under the diagnostic host: ${mut.length}`,
      `- overlay detections (something above the iframe at its centre): ${overlay.length}`,
      overlay.length
        ? `  * example: ${overlay[0].observation}`
        : "  * none — the iframe was the topmost hit-test element at every sample",
      "",
      "4. COVER / FRAME VISUAL RESULT  [NOT OBSERVABLE — CROSS-ORIGIN]",
      "- The parent page cannot read the pixels, poster attribute, <video> element, decoder state, or compositor state inside the Threads iframe.",
      "- Whether the cover frame rendered or appeared black must be judged visually by the human tester, not by this trace.",
      "",
      "5. PLAYBACK  [INFERRED ONLY]",
      `- window blur while the iframe was the activeElement: ${all.filter((e) => e.event === "blur" && e.kind === "INFERRED").length} occurrence(s).`,
      "- This is the ONLY parent-observable playback proxy and it proves focus moved into the iframe, NOT that a video started.",
      "",
      "ERRORS",
      errs.length ? errs.map((e) => `- [${fmt(e.t)}] ${e.event}: ${e.observation}`).join("\n") : "- none captured on the parent page",
      "",
      `Total trace entries: ${all.length}`,
    ].join("\n");
  };

  const exportText = () => {
    const header = {
      tool: "Aelixto Threads Video Diagnostic",
      capturedAt: new Date().toISOString(),
      enteredUrl: url,
      embedSrc,
      environment: env,
    };
    return `${JSON.stringify(header, null, 2)}\n\n=== TRACE ===\n${traceRef.current
      .map((e) => `[${fmt(e.t)}] [${e.category}] [${e.kind}] ${e.event} — ${e.observation}${e.data ? `\n    ${JSON.stringify(e.data)}` : ""}`)
      .join("\n")}\n\n=== SUMMARY ===\n${summary ?? buildSummary()}`;
  };

  const copyTrace = async () => {
    const text = exportText();
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Trace copied", description: `${traceRef.current.length} entries` });
    } catch {
      toast({ title: "Clipboard blocked", description: "Use Export instead", variant: "destructive" });
    }
  };

  const exportTrace = () => {
    const blob = new Blob([exportText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `threads-diagnostic-${env.isNative ? "apk" : "web"}-${Date.now()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  useEffect(() => () => { tracingRef.current = false; }, []);

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Threads Video Diagnostic</h1>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Observation only. Uses the exact production <code>/embed</code> URL builder and raw iframe. The Threads document is
          cross-origin: its <code>&lt;video&gt;</code>, poster, decoder and compositor state are <strong>not observable</strong>.
        </p>

        <div className="flex gap-2 mb-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.threads.net/@user/post/XXXX"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Button size="sm" onClick={start} disabled={tracing}>Load &amp; Trace</Button>
          <Button size="sm" variant="outline" onClick={stop} disabled={!tracing}>Stop Trace</Button>
          <Button size="sm" variant="outline" onClick={() => { traceRef.current = []; setRows([]); setSummary(null); }}>Clear</Button>
          <Button size="sm" variant="outline" onClick={() => { hitTest("checkpoint"); log("CHECKPOINT", "manual", `layout=${JSON.stringify(rectOf(iframeRef.current))} vis=${document.visibilityState}`, "DIRECT", { style: styleOf(iframeRef.current), env }); }} disabled={!tracing}>
            Capture Checkpoint
          </Button>
          <Button size="sm" variant="outline" onClick={copyTrace}>Copy Trace</Button>
          <Button size="sm" variant="outline" onClick={exportTrace}>Export</Button>
        </div>

        {/* Production-identical raw /embed iframe */}
        <div ref={hostRef} className="relative w-full mb-4 rounded-lg overflow-hidden border" style={{ minHeight: embedSrc ? 320 : 0 }}>
          {embedSrc && (
            <iframe
              ref={iframeRef}
              src={embedSrc}
              scrolling="no"
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              onLoad={() => {
                loadTimeRef.current = performance.now() - startRef.current;
                log("IFRAME", "load", `load event fired; connected=${iframeRef.current?.isConnected}`, "DIRECT", {
                  rect: rectOf(iframeRef.current),
                  style: styleOf(iframeRef.current),
                });
                hitTest("post-load");
              }}
              onError={() => log("IFRAME", "iframe-error", "iframe error event fired", "DIRECT")}
              style={{ border: "none", width: "100%", height: 420, display: "block", background: "transparent" }}
            />
          )}
        </div>

        {summary && (
          <pre className="text-[10px] whitespace-pre-wrap bg-muted rounded-lg p-3 mb-4 max-h-80 overflow-auto">{summary}</pre>
        )}

        <div className="rounded-lg border bg-card">
          <div className="px-3 py-2 text-xs font-semibold border-b">
            Live trace — {rows.length} shown / {traceRef.current.length} stored
          </div>
          <div className="max-h-[50vh] overflow-auto font-mono text-[10px] leading-tight">
            {rows.map((e, i) => (
              <div key={i} className="px-3 py-1 border-b border-border/40">
                <span className="text-muted-foreground">[{fmt(e.t)}]</span>{" "}
                <span className="font-semibold">{e.category}</span>{" "}
                <span className="text-muted-foreground">[{e.kind}]</span> — {e.event}: {e.observation}
              </div>
            ))}
            {rows.length === 0 && <div className="px-3 py-6 text-center text-muted-foreground">No events yet.</div>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ThreadsVideoDiagnostic;
