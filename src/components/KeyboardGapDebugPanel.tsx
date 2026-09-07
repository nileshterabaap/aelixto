/**
 * DEBUG ONLY — temporary keyboard/composer geometry probe.
 *
 * Renders nothing unless explicitly enabled (native platform AND either a dev
 * build, `?kbdebug=1` in the URL, or localStorage `kbdebug === "1"`).
 * The panel is `position: fixed` + `pointer-events: none`, so it cannot alter
 * document height, scrolling, keyboard behavior or composer positioning.
 * It never changes any app state.
 */

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

type Snap = Record<string, string | number | null>;

const num = (v: unknown) => (typeof v === "number" ? Math.round(v * 100) / 100 : null);

function readEnvInset(side: "top" | "bottom"): string {
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;left:-9999px;top:-9999px;height:env(safe-area-inset-${side}, 0px);pointer-events:none;`;
  document.body.appendChild(probe);
  const h = getComputedStyle(probe).height;
  probe.remove();
  return h;
}

function collect(rawKb: number): Snap {
  const de = document.documentElement;
  const vv = window.visualViewport;
  const cs = getComputedStyle(de);
  const composer = document.querySelector<HTMLElement>('[data-kbdebug="composer"]')
    ?? document.querySelector<HTMLElement>("form")?.closest<HTMLElement>("div");
  const chatRoot = document.querySelector<HTMLElement>('[data-kbdebug="chat-root"]');
  const r = composer?.getBoundingClientRect();
  const ccs = composer ? getComputedStyle(composer) : null;

  const kbVar = cs.getPropertyValue("--kb").trim();
  const safeBottomVar = cs.getPropertyValue("--safe-bottom").trim();

  // The "visible web area" is the layout viewport the WebView currently owns.
  const visibleBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;

  return {
    t: new Date().toISOString().slice(11, 23),
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    outerW: window.outerWidth,
    outerH: window.outerHeight,
    docClientW: de.clientWidth,
    docClientH: de.clientHeight,
    bodyClientW: document.body.clientWidth,
    bodyClientH: document.body.clientHeight,
    vvW: num(vv?.width),
    vvH: num(vv?.height),
    vvOffTop: num(vv?.offsetTop),
    vvOffLeft: num(vv?.offsetLeft),
    vvPageTop: num(vv?.pageTop),
    vvPageLeft: num(vv?.pageLeft),
    vvScale: num(vv?.scale),
    dpr: window.devicePixelRatio,
    envTop: readEnvInset("top"),
    envBottom: readEnvInset("bottom"),
    kbVar,
    safeBottomVar,
    kbOpenClass: String(de.classList.contains("kb-open")),
    rawPluginKb: rawKb,
    chatRootH: chatRoot ? Math.round(chatRoot.getBoundingClientRect().height) : null,
    cTop: r ? Math.round(r.top) : null,
    cBottom: r ? Math.round(r.bottom) : null,
    cHeight: r ? Math.round(r.height) : null,
    cLeft: r ? Math.round(r.left) : null,
    cRight: r ? Math.round(r.right) : null,
    cPosition: ccs?.position ?? null,
    cCssBottom: ccs?.bottom ?? null,
    cMarginBottom: ccs?.marginBottom ?? null,
    cPaddingBottom: ccs?.paddingBottom ?? null,
    cTransform: ccs?.transform ?? null,
    cCssHeight: ccs?.height ?? null,
    // RAW gap candidates — do not trust one alone.
    gap_innerH_minus_cBottom: r ? Math.round(window.innerHeight - r.bottom) : null,
    gap_vvVisible_minus_cBottom: r ? Math.round(visibleBottom - r.bottom) : null,
    gap_docClientH_minus_cBottom: r ? Math.round(de.clientHeight - r.bottom) : null,
  };
}

export function KeyboardGapDebugPanel() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [closedSnap, setClosedSnap] = useState<Snap | null>(null);
  const [openSnap, setOpenSnap] = useState<Snap | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const rawKb = useRef(0);

  // TEMPORARY: always on for native builds (release APKs included) so the
  // readout appears without any hidden switch. Set localStorage kbdebug=0 to
  // silence it. Remove this component once measurements are captured.
  const enabled = (() => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      if (new URLSearchParams(window.location.search).get("kbdebug") === "0") return false;
      return localStorage.getItem("kbdebug") !== "0";
    } catch {
      return true;
    }
  })();

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const push = (label: string) => {
      const s = collect(rawKb.current);
      if (!alive) return;
      setSnap(s);
      if (document.documentElement.classList.contains("kb-open")) setOpenSnap(s);
      else setClosedSnap(s);
      setEvents((prev) =>
        [`${s.t} ${label} inner=${s.innerH} vv=${s.vvH} kb=${s.kbVar} cBot=${s.cBottom} gapVV=${s.gap_vvVisible_minus_cBottom}`, ...prev].slice(0, 8),
      );
    };

    push("init");
    const onResize = () => push("resize");
    const onVVResize = () => push("vv-resize");
    const onVVScroll = () => push("vv-scroll");
    const onOrient = () => push("orientation");

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onVVResize);
    window.visualViewport?.addEventListener("scroll", onVVScroll);
    window.addEventListener("orientationchange", onOrient);
    const tick = window.setInterval(() => push("tick"), 500);

    void (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        await Keyboard.addListener("keyboardWillShow", (i) => { rawKb.current = i.keyboardHeight; push("kbWillShow"); });
        await Keyboard.addListener("keyboardDidShow", (i) => { rawKb.current = i.keyboardHeight; push("kbDidShow"); });
        await Keyboard.addListener("keyboardWillHide", () => { rawKb.current = 0; push("kbWillHide"); });
        await Keyboard.addListener("keyboardDidHide", () => { rawKb.current = 0; push("kbDidHide"); });
      } catch {
        /* plugin unavailable */
      }
    })();

    return () => {
      alive = false;
      window.clearInterval(tick);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onVVResize);
      window.visualViewport?.removeEventListener("scroll", onVVScroll);
      window.removeEventListener("orientationchange", onOrient);
    };
  }, [enabled]);

  if (!enabled || !snap) return null;

  const row = (k: string) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
      <span style={{ opacity: 0.7 }}>{k}</span>
      <span>{String(snap[k])}</span>
    </div>
  );

  const cmp = (k: string) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
      <span style={{ opacity: 0.7 }}>{k}</span>
      <span>{String(closedSnap?.[k] ?? "-")} | {String(openSnap?.[k] ?? "-")}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        maxHeight: "62vh",
        overflow: "hidden",
        zIndex: 2147483647,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.82)",
        color: "#0f0",
        font: "9px/1.25 monospace",
        padding: "4px 6px",
        whiteSpace: "pre",
      }}
    >
      <div style={{ color: "#ff0" }}>DEBUG ONLY — keyboard/composer geometry</div>
      {[
        "innerW","innerH","outerW","outerH","docClientW","docClientH","bodyClientW","bodyClientH",
        "vvW","vvH","vvOffTop","vvOffLeft","vvPageTop","vvPageLeft","vvScale","dpr",
        "envTop","envBottom","kbVar","safeBottomVar","kbOpenClass","rawPluginKb","chatRootH",
        "cTop","cBottom","cHeight","cLeft","cRight","cPosition","cCssBottom","cMarginBottom",
        "cPaddingBottom","cTransform","cCssHeight",
        "gap_innerH_minus_cBottom","gap_vvVisible_minus_cBottom","gap_docClientH_minus_cBottom",
      ].map(row)}
      <div style={{ color: "#ff0", marginTop: 2 }}>CLOSED | OPEN</div>
      {["innerH","vvH","vvOffTop","kbVar","rawPluginKb","cBottom","cHeight","gap_vvVisible_minus_cBottom","gap_innerH_minus_cBottom"].map(cmp)}
      <div style={{ color: "#ff0", marginTop: 2 }}>EVENTS</div>
      {events.map((e, i) => <div key={i}>{e}</div>)}
    </div>
  );
}

export default KeyboardGapDebugPanel;
