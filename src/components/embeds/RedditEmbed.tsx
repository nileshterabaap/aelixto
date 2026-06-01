import { useEffect, useMemo, useRef, useState } from "react";
import { OgCardFallback } from "@/components/OgCardFallback";
import { supabase } from "@/integrations/supabase/client";

type RedditEmbedProps = {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  authorAvatar?: string | null;
};

const REDDIT_WIDGET_SRC = "https://embed.reddit.com/widgets.js";
const REDDIT_EMBED_HEIGHT = 316;

function ensureProtocol(rawUrl: string): string {
  const trimmed = rawUrl.trim().split(/\s+/)[0];
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isRedditHost(hostname: string): boolean {
  return /(^|\.)reddit\.com$/i.test(hostname) || /^redd\.it$/i.test(hostname);
}

/**
 * Reddit's official widgets.js only hydrates canonical `/comments/` URLs,
 * subreddit URLs, and blockquotes it can rewrite into embed.reddit.com.
 * Normalize every common Reddit share form into that canonical shape first.
 */
function normalizeRedditEmbedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(ensureProtocol(rawUrl));
    if (!isRedditHost(u.hostname)) return null;

    if (/^redd\.it$/i.test(u.hostname)) {
      return null;
    }

    if (/^\/gallery\/[a-z0-9_]+/i.test(u.pathname)) return null;

    if (/^\/(?:r|user)\/[^/]+\/comments\/[a-z0-9_]+(?:\/.*)?$/i.test(u.pathname)) {
      return `https://www.reddit.com${u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`}`;
    }

    if (/^\/r\/[^/]+\/?$/i.test(u.pathname)) {
      return `https://www.reddit.com${u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`}`;
    }

    return null;
  } catch {
    return null;
  }
}

function shouldExpandRedditUrl(rawUrl: string): boolean {
  try {
    const u = new URL(ensureProtocol(rawUrl));
    if (!isRedditHost(u.hostname)) return false;
    return !normalizeRedditEmbedUrl(rawUrl) || /\/(?:r|user)\/[^/]+\/s\/[^/]+\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export default function RedditEmbed({ url, title, thumbnailUrl, description, authorAvatar }: RedditEmbedProps) {
  const directUrl = useMemo(() => normalizeRedditEmbedUrl(url), [url]);
  const needsExpansion = useMemo(() => shouldExpandRedditUrl(url), [url]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl);
  const [resolving, setResolving] = useState(needsExpansion && !directUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Expand mobile `/s/` links and other short shares before asking widgets.js to hydrate.
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setLoaded(false);

    if (directUrl) {
      setResolvedUrl(directUrl);
      setResolving(false);
      return () => { cancelled = true; };
    }

    if (!needsExpansion) {
      setResolvedUrl(null);
      setResolving(false);
      setFailed(true);
      return () => { cancelled = true; };
    }

    setResolving(true);
    setResolvedUrl(null);

    supabase.functions.invoke("expand-url", { body: { url: ensureProtocol(url) } })
      .then(({ data }) => {
        if (cancelled) return;
        const expanded = normalizeRedditEmbedUrl(data?.finalUrl || url);
        if (expanded) {
          setResolvedUrl(expanded);
          setFailed(false);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [directUrl, needsExpansion, url]);

  // Official Reddit renderer: blockquote + widgets.js, exactly like publish.reddit.com.
  useEffect(() => {
    if (!resolvedUrl || resolving || failed) return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let script: HTMLScriptElement | null = null;

    const markReady = () => {
      if (cancelled) return;
      setLoaded(true);
      container.dispatchEvent(new CustomEvent("embedReady", { bubbles: true }));
    };

    const handledIframes = new WeakSet<HTMLIFrameElement>();
    const attachIframe = () => {
      const iframe = container.querySelector("iframe") as HTMLIFrameElement | null;
      if (!iframe) return false;
      if (handledIframes.has(iframe)) return true;
      handledIframes.add(iframe);
      iframe.style.maxWidth = "100%";
      iframe.style.width = "100%";
      iframe.addEventListener("load", markReady, { once: true });
      iframe.addEventListener("error", markReady, { once: true });
      return true;
    };

    container.replaceChildren();

    const blockquote = document.createElement("blockquote");
    blockquote.className = "reddit-embed-bq";
    blockquote.setAttribute("data-embed-height", String(REDDIT_EMBED_HEIGHT));
    blockquote.setAttribute("data-embed-showmedia", "true");
    blockquote.style.height = `${REDDIT_EMBED_HEIGHT}px`;

    const link = document.createElement("a");
    link.href = resolvedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = title || "Reddit post";
    blockquote.appendChild(link);
    container.appendChild(blockquote);

    const observer = new MutationObserver(() => { attachIframe(); });
    observer.observe(container, { childList: true, subtree: true });

    const fallback = window.setTimeout(() => {
      if (!container.querySelector("iframe")) {
        setFailed(true);
      } else {
        markReady();
      }
    }, 8500);

    requestAnimationFrame(() => {
      if (cancelled) return;
      script = document.createElement("script");
      script.src = `${REDDIT_WIDGET_SRC}?aelixto=${Date.now().toString(36)}`;
      script.async = true;
      script.charset = "UTF-8";
      script.onerror = () => setFailed(true);
      document.body.appendChild(script);
      attachIframe();
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(fallback);
      container.replaceChildren();
      if (script?.parentNode) script.parentNode.removeChild(script);
    };
  }, [resolvedUrl, resolving, failed, title]);

  if (resolving || (!resolvedUrl && !failed)) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: REDDIT_EMBED_HEIGHT }} />;
  }

  if (!resolvedUrl || failed) {
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
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ minHeight: loaded ? undefined : REDDIT_EMBED_HEIGHT }}
      data-embed-status={loaded ? "ready" : "loading"}
    />
  );
}
