import { useEffect, useMemo, useState } from "react";
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

function sameUrl(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

function isDirectRedditMediaUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  try {
    const u = new URL(ensureProtocol(rawUrl));
    const host = u.hostname.toLowerCase();
    return (
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u.href) ||
      host === "i.redd.it" ||
      host === "preview.redd.it" ||
      host.endsWith("redditmedia.com")
    );
  } catch {
    return false;
  }
}

function isVideoUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(rawUrl);
}

export default function RedditEmbed({ url, title, thumbnailUrl, description, authorAvatar }: RedditEmbedProps) {
  const normalizedUrl = useMemo(() => ensureProtocol(url), [url]);
  const directUrl = useMemo(() => normalizeRedditEmbedUrl(url), [url]);
  const needsExpansion = useMemo(() => shouldExpandRedditUrl(url), [url]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl);
  const [resolving, setResolving] = useState(needsExpansion && !directUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const isDirectMedia = isDirectRedditMediaUrl(normalizedUrl);
  const validThumb = !!thumbnailUrl && !thumbBroken && !sameUrl(thumbnailUrl, authorAvatar);
  const fallbackImage = validThumb ? thumbnailUrl! : undefined;
  const iframeUrl = useMemo(() => resolvedUrl ? toRedditIframeUrl(resolvedUrl) : null, [resolvedUrl]);

  // Detect broken/blocked Reddit thumbnails (e.g. URLs that 403 or 404) so the
  // fallback card swaps to the author's profile picture instead of rendering a
  // broken <img>, matching the X/Threads behavior.
  useEffect(() => {
    setThumbBroken(false);
    if (!thumbnailUrl || sameUrl(thumbnailUrl, authorAvatar)) return;
    let cancelled = false;
    const probe = new Image();
    probe.onerror = () => { if (!cancelled) setThumbBroken(true); };
    probe.src = thumbnailUrl;
    return () => { cancelled = true; };
  }, [thumbnailUrl, authorAvatar]);

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
        {isDirectMedia ? (
          <a
            href={normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-card"
          >
            {isVideoUrl(normalizedUrl) ? (
              <video src={normalizedUrl} className="w-full h-auto" controls playsInline />
            ) : (
              <img src={normalizedUrl} alt={title || "Reddit post"} className="w-full h-auto object-cover" loading="eager" />
            )}
          </a>
        ) : fallbackImage ? (
          <a
            href={normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full"
          >
            <OgCardFallback
              url={normalizedUrl}
              platform="Reddit"
              title={title || undefined}
              image={fallbackImage}
              description={description || undefined}
            />
          </a>
        ) : (
          <a
            href={normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full border-y border-border bg-card px-5 py-8 text-foreground transition-colors hover:bg-accent"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <img src={redditIcon} alt="" className="w-10 h-10" />
              <div className="text-base font-semibold leading-snug">Reddit Post</div>
              {title ? (
                <div className="text-sm text-muted-foreground line-clamp-2 max-w-md">{title}</div>
              ) : null}
            </div>
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      style={{ minHeight: REDDIT_EMBED_HEIGHT }}
      data-embed-status={loaded ? "ready" : "loading"}
    >
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
