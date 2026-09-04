/**
 * DEBUG ONLY — temporary keyboard/viewport measurement overlay.
 *
 * Native (Capacitor) builds only. Adds passive listeners; it does NOT change
 * Keyboard.resize, --kb, safe-area handling or any layout. Remove once the
 * device numbers are captured.
 */
import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

type Snap = {
  innerH: number;
  vvH: number | null;
  vvOffset: number | null;
  dpr: number;
  rawKb: number | null;
  kbVar: string;
  kbOpen: boolean;
  chatH: number | null;
  composerH: number | null;
  listH: number | null;
};

const read = (rawKb: number | null): Snap => {
  const root = document.documentElement;
  const q = (sel: string) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  };
  return {
    innerH: window.innerHeight,
    vvH: window.visualViewport ? Math.round(window.visualViewport.height) : null,
    vvOffset: window.visualViewport ? Math.round(window.visualViewport.offsetTop) : null,
    dpr: window.devicePixelRatio || 1,
    rawKb,
    kbVar: getComputedStyle(root).getPropertyValue("--kb").trim() || "0px",
    kbOpen: root.classList.contains("kb-open"),
    chatH: q('[data-kbdebug="chat-root"]'),
    composerH: q('[data-kbdebug="composer"]'),
    listH: q('[data-kbdebug="list"]'),
  };
};

export const KeyboardDebugPanel = () => {
  const [snap, setSnap] = useState<Snap | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let rawKb: number | null = null;
    let alive = true;

    const tick = () => {
      if (alive) setSnap(read(rawKb));
    };

    const id = window.setInterval(tick, 250);
    window.addEventListener("resize", tick);
    window.visualViewport?.addEventListener("resize", tick);
    tick();

    const cleanups: Array<() => void> = [];
    void (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        const show = await Keyboard.addListener("keyboardDidShow", (info) => {
          rawKb = info.keyboardHeight;
          tick();
        });
        const hide = await Keyboard.addListener("keyboardDidHide", () => {
          rawKb = 0;
          tick();
        });
        cleanups.push(() => void show.remove(), () => void hide.remove());
      } catch {
        /* plugin unavailable */
      }
    })();

    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("resize", tick);
      window.visualViewport?.removeEventListener("resize", tick);
      cleanups.forEach((c) => c());
    };
  }, []);

  if (!snap) return null;

  const rows: Array<[string, string]> = [
    ["innerHeight", `${snap.innerH}`],
    ["visualViewport.h", snap.vvH === null ? "n/a" : `${snap.vvH}`],
    ["vv.offsetTop", snap.vvOffset === null ? "n/a" : `${snap.vvOffset}`],
    ["devicePixelRatio", `${snap.dpr}`],
    ["raw plugin kb", snap.rawKb === null ? "—" : `${snap.rawKb}`],
    ["--kb", snap.kbVar],
    ["kb-open", snap.kbOpen ? "yes" : "no"],
    ["chat root h", snap.chatH === null ? "—" : `${snap.chatH}`],
    ["msg list h", snap.listH === null ? "—" : `${snap.listH}`],
    ["composer h", snap.composerH === null ? "—" : `${snap.composerH}`],
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 2147483647,
        pointerEvents: "none",
        background: "rgba(0,0,0,0.78)",
        color: "#0f0",
        font: "11px/1.35 monospace",
        padding: "6px 8px",
        maxWidth: "62vw",
        borderBottomRightRadius: 8,
      }}
    >
      <div style={{ color: "#ff5", fontWeight: 700 }}>DEBUG ONLY — keyboard</div>
      {rows.map(([k, v]) => (
        <div key={k}>
          {k}: <span style={{ color: "#fff" }}>{v}</span>
        </div>
      ))}
    </div>
  );
};
