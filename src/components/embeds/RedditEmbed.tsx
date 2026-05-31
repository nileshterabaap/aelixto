import { useEffect, useMemo, useRef, useState } from "react";
import { OgCardFallback } from "@/components/OgCardFallback";

type RedditEmbedProps = {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  authorAvatar?: string | null;
};

/**
 * Build a direct embed.reddit.com iframe URL from any Reddit post link
 * (including mobile `/r/<sub>/s/<code>` share links). Reddit's official
 * widgets.js only matches `/comments/` paths and silently does nothing for
 * `/s/` links — so we always replicate what widgets.js *would* have done
 * for valid links, but route every Reddit URL through it.
 */
function buildRedditEmbedSrc(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!/(^|\.)reddit\.com$/.test(u.hostname) && u.hostname !== "redd.it") return null;
    const path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
    const params = new URLSearchParams({
      embed: "true",
      ref_source: "embed",
      ref: "share",
      utm_medium: "widgets",
      utm_source: "embedv2",
      utm_term: "23",
      utm_name: "post_embed",
      embed_host_url: typeof window !== "undefined" ? window.location.origin : "",
    });
    return `https://embed.reddit.com${path}?${params.toString()}`;
  } catch {
    return null;
  }
}

function isRedditShortShareUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return /\/(?:r|user)\/[^/]+\/s\/[^/]+\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export default function RedditEmbed({ url, title, thumbnailUrl, description, authorAvatar }: RedditEmbedProps) {
  const src = useMemo(() => buildRedditEmbedSrc(url), [url]);
  const previewOnly = useMemo(() => isRedditShortShareUrl(url), [url]);
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

  // If the iframe never reports a load within 8s, fall back to a rich preview.
  useEffect(() => {
    if (!src || previewOnly) return;
    const t = setTimeout(() => {
      if (!loaded) setFailed(true);
    }, 8000);
    return () => clearTimeout(t);
  }, [src, loaded, previewOnly]);

  if (!src || failed || previewOnly) {
    return (
      <div data-embed-status="ready">
        <OgCardFallback
          url={url}
          platform="Reddit"
          title={title || undefined}
          image={thumbnailUrl || authorAvatar || undefined}
          description={description || undefined}
        />
      </div>
    );
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
