import { useEffect, useMemo, useRef, useState } from "react";
import { OgCardFallback } from "@/components/OgCardFallback";
import { supabase } from "@/integrations/supabase/client";
import { loadRedditEmbed } from "@/lib/ScriptLoader";
import redditIcon from "@/assets/platforms/reddit.svg";

type RedditEmbedProps = {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  authorAvatar?: string | null;
  postId?: string | null;
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

    if (/^\/gallery\/[a-z0-9_]+/i.test(u.pathname)) {
      return `https://www.reddit.com${u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`}`;
    }

    // Mobile share URLs (`/r/.../s/...`) are not accepted by embed.reddit.com;
    // sending them straight to the iframe renders Reddit's own "Page not found".
    // Force these through expand-url first so we iframe the canonical /comments/ URL.
    if (/^\/(?:r|user)\/[^/]+\/s\/[^/]+\/?$/i.test(u.pathname)) {
      return null;
    }

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
    return !normalizeRedditEmbedUrl(rawUrl);
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

function isRedditShareUrl(rawUrl: string): boolean {
  try {
    const u = new URL(ensureProtocol(rawUrl));
    return isRedditHost(u.hostname) && /^\/(?:r|user)\/[^/]+\/s\/[^/]+\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export default function RedditEmbed({ url, title, thumbnailUrl, description, authorAvatar, postId }: RedditEmbedProps) {
  const normalizedUrl = useMemo(() => ensureProtocol(url), [url]);
  const directUrl = useMemo(() => normalizeRedditEmbedUrl(url), [url]);
  const needsExpansion = useMemo(() => shouldExpandRedditUrl(url), [url]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl);
  const [resolving, setResolving] = useState(needsExpansion && !directUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const [fetchedThumb, setFetchedThumb] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDirectMedia = isDirectRedditMediaUrl(normalizedUrl);
  const effectiveThumb = thumbnailUrl || fetchedThumb;
  const validThumb = !!effectiveThumb && !thumbBroken && !sameUrl(effectiveThumb, authorAvatar);
  const fallbackImage = validThumb ? effectiveThumb! : undefined;
  const shouldRenderStoredImage = !isDirectMedia && validThumb && isRedditShareUrl(normalizedUrl);

  // Detect broken/blocked Reddit thumbnails (e.g. URLs that 403 or 404) so the
  // fallback card swaps to the author's profile picture instead of rendering a
  // broken <img>, matching the X/Threads behavior.
  useEffect(() => {
    setThumbBroken(false);
    if (!effectiveThumb || sameUrl(effectiveThumb, authorAvatar)) return;
    let cancelled = false;
    const probe = new Image();
    probe.onerror = () => { if (!cancelled) setThumbBroken(true); };
    probe.src = effectiveThumb;
    return () => { cancelled = true; };
  }, [effectiveThumb, authorAvatar]);

  // Lazily fetch + persist a real Reddit thumbnail when one isn't already
  // stored. This guarantees image posts have something to render if the
  // official embed iframe errors out (it frequently does for image/gallery
  // submissions).
  useEffect(() => {
    if (thumbnailUrl || fetchedThumb || !postId) return;
    let cancelled = false;
    supabase.functions
      .invoke("fetch-post-preview", { body: { postId, url: normalizedUrl, platform: "reddit" } })
      .then(({ data }) => {
        if (cancelled) return;
        const t = (data as any)?.thumbnailUrl || (data as any)?.thumbnail_url;
        if (t) setFetchedThumb(t);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [postId, normalizedUrl, thumbnailUrl, fetchedThumb]);

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
    if (!resolvedUrl || resolving || failed || loaded) return;
    if (!containerRef.current) return;

    // Mount Reddit's official blockquote widget. embed.reddit.com/widgets.js
    // scans the DOM for `blockquote.reddit-embed-bq` and replaces them with
    // an iframe that correctly renders image, gallery, and video posts.
    const container = containerRef.current;
    container.innerHTML = "";
    const bq = document.createElement("blockquote");
    bq.className = "reddit-embed-bq";
    bq.setAttribute("data-embed-height", String(REDDIT_EMBED_HEIGHT));
    bq.setAttribute("data-embed-showmedia", "true");
    const a = document.createElement("a");
    a.href = resolvedUrl;
    a.textContent = title || "Reddit post";
    bq.appendChild(a);
    container.appendChild(bq);

    // Observe iframe insertion to mark ready
    const observer = new MutationObserver(() => {
      if (container.querySelector("iframe")) {
        setLoaded(true);
        container.dispatchEvent(new CustomEvent("embedReady", { bubbles: true }));
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true, subtree: true });

    loadRedditEmbed().catch(() => {});

    const fallback = window.setTimeout(() => setLoaded(true), REDDIT_IFRAME_TIMEOUT);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [resolvedUrl, resolving, failed, loaded, title]);

  if (shouldRenderStoredImage) {
    return (
      <div data-embed-status="ready">
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-card"
        >
          <img src={fallbackImage} alt={title || "Reddit post"} className="w-full h-auto object-cover" loading="eager" />
        </a>
      </div>
    );
  }

  if (resolving || (!resolvedUrl && !failed)) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: REDDIT_EMBED_HEIGHT }} />;
  }

  if (!resolvedUrl || failed) {
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
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
