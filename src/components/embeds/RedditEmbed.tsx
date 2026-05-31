import { useEffect, useMemo, useRef, useState } from "react";
import { OgCardFallback } from "@/components/OgCardFallback";
import { buildRedditEmbedSrc } from "@/lib/redditUrls";

/**
 * Build a direct embed.reddit.com iframe URL only for canonical Reddit post
 * URLs. Mobile `/r/<sub>/s/<code>` share links are personalized redirectors;
 * Reddit's embed host returns a real HTTP 200 with a visible "Page not found"
 * screen for them, so never iframe those unresolved links.
 */
export default function RedditEmbed({ url }: { url: string }) {
  const src = useMemo(() => buildRedditEmbedSrc(url), [url]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(420);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Listen for Reddit's `resize.embed` postMessage to auto-size, mirroring
  // the protocol used by embed.reddit.com's widgets.js iframe.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;

      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (!payload || typeof payload !== "object") return;
      const obj = payload as { type?: string; data?: unknown };
      if (obj.type !== "resize.embed") return;
      const next = typeof obj.data === "number"
        ? obj.data
        : Number(obj.data);
      if (!Number.isFinite(next) || next < 80) return;
      setHeight((prev) => (Math.abs(prev - next) > 2 ? Math.round(next) : prev));
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // If the iframe never reports a load within 8s, fall back to an OG card.
  useEffect(() => {
    if (!src) return;
    const t = setTimeout(() => {
      if (!loaded) setFailed(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [src, loaded]);

  if (!src || failed) {
    return <OgCardFallback url={url} platform="Reddit" />;
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: `${height}px`, minHeight: "260px" }}
      data-embed-status={loaded ? "ready" : "loading"}
    >
      <iframe
        ref={iframeRef}
        src={src}
        title="Reddit post"
        scrolling="no"
        loading="lazy"
        allowFullScreen
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-popups"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          border: "none",
          width: "100%",
          height: "100%",
          display: "block",
          borderRadius: "8px",
          background: "transparent",
        }}
      />
    </div>
  );
}
