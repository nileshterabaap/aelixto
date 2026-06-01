import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { OgCardFallback } from "@/components/OgCardFallback";
import { supabase } from "@/integrations/supabase/client";
import redditIcon from "@/assets/platforms/reddit.svg";

type RedditEmbedProps = {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  authorAvatar?: string | null;
};

const REDDIT_EMBED_HEIGHT = 316;
const REDDIT_IFRAME_TIMEOUT = 8500;

function getSafeHost(rawUrl: string): string {
  try {
    return new URL(ensureProtocol(rawUrl)).hostname.replace(/^www\./, "");
  } catch {
    return "reddit.com";
  }
}

function isMediaLikeUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  const lower = rawUrl.toLowerCase();
  return /\.(png|jpe?g|webp|gif|mp4|mov)(\?|$)/i.test(lower) ||
    lower.includes("/gallery/") ||
    lower.includes("/video/") ||
    lower.includes("v.redd.it") ||
    lower.includes("i.redd.it") ||
    lower.includes("preview.redd.it");
}

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

function toRedditIframeUrl(canonicalUrl: string): string | null {
  try {
    const u = new URL(canonicalUrl);
    if (!/(^|\.)reddit\.com$/i.test(u.hostname)) return null;
    const params = new URLSearchParams({ embed: "true", showmedia: "true" });
    return `https://embed.reddit.com${u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`}?${params.toString()}`;
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
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl);
  const [resolving, setResolving] = useState(needsExpansion && !directUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fallbackImage = thumbnailUrl || authorAvatar || undefined;
  const iframeUrl = useMemo(() => resolvedUrl ? toRedditIframeUrl(resolvedUrl) : null, [resolvedUrl]);
  const safeUrl = ensureProtocol(resolvedUrl || url);
  const hasMediaPreview = !!thumbnailUrl && isMediaLikeUrl(thumbnailUrl);

  // Expand mobile `/s/` links and other short shares before rendering Reddit's official iframe.
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

  useEffect(() => {
    if (!resolvedUrl || resolving || failed || !iframeUrl || loaded) return;
    const fallback = window.setTimeout(() => setLoaded(true), REDDIT_IFRAME_TIMEOUT);
    return () => window.clearTimeout(fallback);
  }, [resolvedUrl, resolving, failed, iframeUrl, loaded]);

  if (resolving || (!resolvedUrl && !failed)) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: REDDIT_EMBED_HEIGHT }} />;
  }

  if (!resolvedUrl || !iframeUrl || failed) {
    return (
      <div data-embed-status="ready">
        {fallbackImage || title || description ? (
          <OgCardFallback
            url={url}
            platform="Reddit"
            title={title || undefined}
            image={fallbackImage}
            description={description || undefined}
          />
        ) : (
          <a
            href={ensureProtocol(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full border-y border-border bg-card px-5 py-6 text-foreground transition-colors hover:bg-accent"
          >
            <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Reddit</div>
            <div className="mt-1 text-base font-semibold leading-snug">Open Reddit post</div>
          </a>
        )}
      </div>
    );
  }

  if (hasMediaPreview) {
    return (
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full overflow-hidden border-y border-border bg-card text-foreground transition-colors hover:bg-accent"
        data-embed-status="ready"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <img
            src={thumbnailUrl}
            alt={title || "Reddit post preview"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/85 px-2.5 py-1 backdrop-blur-sm">
            <img src={redditIcon} alt="" className="h-4 w-4" />
            <span className="text-xs font-semibold">Reddit</span>
          </div>
          <div className="absolute inset-0 grid place-items-center bg-foreground/10 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur-sm">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-base font-semibold leading-snug">
              {title || "Open Reddit post"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{getSafeHost(safeUrl)}</div>
          </div>
          <ExternalLink className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </a>
    );
  }

  return (
    <div
      className="relative w-full"
      style={{ minHeight: REDDIT_EMBED_HEIGHT }}
      data-embed-status={loaded ? "ready" : "loading"}
    >
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Reddit post"
        className="absolute inset-0 z-10 block"
      />
      <iframe
        src={iframeUrl}
        title={title || "Reddit post"}
        className="block w-full border-0 bg-card"
        style={{ minHeight: REDDIT_EMBED_HEIGHT }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
