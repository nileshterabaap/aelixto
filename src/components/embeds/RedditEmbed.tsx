import { useEffect, useMemo, useRef, useState } from "react";
import { OgCardFallback } from "@/components/OgCardFallback";
import { supabase } from "@/integrations/supabase/client";
import redditIcon from "@/assets/platforms/reddit.svg";
import { usePersistEmbedHeight } from "@/hooks/usePersistEmbedHeight";

type RedditEmbedProps = {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  authorAvatar?: string | null;
  postId?: string | null;
  mediaKind?: string | null;
  aspectRatio?: number | null;
  suggestedHeight?: number | null;
};

// Allow the iframe to hug very short text previews (Reddit collapses the body
// behind a "Read more" toggle, so the pre-expand height can be well under
// 240px) and to grow far enough for long expanded threads without clipping.
const REDDIT_EMBED_MIN_HEIGHT = 120;
const REDDIT_EMBED_MAX_HEIGHT = 4000;
const REDDIT_EMBED_INITIAL_HEIGHT = 380;
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

    // Mobile app share links (`/s/<code>`) are not embeddable by Reddit's
    // iframe endpoint. They must be expanded to the canonical `/comments/`
    // URL first.
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

function toRedditEmbedSrc(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname.replace(/^\//, "");
    const isEmbeddablePath =
      /^(?:r|user)\/[^/]+\/comments\/[a-z0-9_]+(?:\/.*)?$/i.test(path);
    if (!isEmbeddablePath) return null;

    const params = new URLSearchParams();
    params.set("showmedia", "true");
    params.set("showmore", "false");
    params.set("depth", "1");
    params.set("utm_name", "post_embed");

    return `https://embed.reddit.com/${path.endsWith("/") ? path : `${path}/`}?${params.toString()}`;
  } catch {
    return null;
  }
}

export default function RedditEmbed({ url, title, thumbnailUrl, description, authorAvatar, postId, mediaKind, aspectRatio, suggestedHeight }: RedditEmbedProps) {
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Smart initial height: text posts get a compact suggested_height,
  // media posts derive from aspect_ratio + an action-bar allowance,
  // and anything unclassified falls back to the legacy initial value.
  const computeInitialHeight = (): number => {
    const viewportWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth, 640) : 400;
    if (mediaKind === 'text') {
      // Do not seed collapsed text posts from `suggested_height`: Reddit can
      // report/persist the full expanded post height while the visible body is
      // still collapsed behind "Read more", which creates the blank iframe
      // viewport underneath the preview on first render.
      return 240;
    }
    if (aspectRatio && aspectRatio > 0 && (mediaKind === 'video' || mediaKind === 'image' || mediaKind === 'gallery')) {
      // Reddit's chrome (header + action bar + comments button) takes ~210px.
      const mediaH = viewportWidth / aspectRatio;
      return Math.min(REDDIT_EMBED_MAX_HEIGHT, Math.max(REDDIT_EMBED_MIN_HEIGHT, Math.ceil(mediaH + 210)));
    }
    if (mediaKind === 'article' && suggestedHeight) {
      return Math.min(REDDIT_EMBED_MAX_HEIGHT, Math.max(REDDIT_EMBED_MIN_HEIGHT, suggestedHeight));
    }
    return REDDIT_EMBED_INITIAL_HEIGHT;
  };
  const [iframeHeight, setIframeHeight] = useState<number>(computeInitialHeight);
  // Reddit's iframe reports the FULL post height even while the body is
  // visually collapsed behind "Read more", producing a large blank strip
  // under the preview. Cap the height for text posts until the user actually
  // interacts with the iframe (tap = likely "Read more"), then follow
  // Reddit's reported height freely.
  const COLLAPSED_TEXT_CAP = 380;
  const [userExpanded, setUserExpanded] = useState(false);
  const firstHeightLoggedRef = useRef(false);
  const isDirectMedia = isDirectRedditMediaUrl(normalizedUrl);
  const effectiveThumb = thumbnailUrl || fetchedThumb;
  const validThumb = !!effectiveThumb && !thumbBroken && !sameUrl(effectiveThumb, authorAvatar);
  const fallbackImage = validThumb ? effectiveThumb! : undefined;
  const embedSrc = useMemo(() => (resolvedUrl ? toRedditEmbedSrc(resolvedUrl) : null), [resolvedUrl]);
  const persistHeight = usePersistEmbedHeight(postId);

  // Previously we ran an `Image()` probe here to mark broken thumbnails, but
  // Reddit's `external-preview.redd.it` CDN sometimes rejects cross-origin
  // probe requests inside the Capacitor WebView even though the actual
  // `<img>` tag renders fine. That caused valid Reddit thumbnails to be
  // dropped and the fallback card to collapse into the plain "Reddit Post"
  // text placeholder. Trust the `<img>` tag itself and only mark the thumb
  // broken if the real image tag we render below fires `onError`.

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
    if (!embedSrc || resolving || failed || loaded) return;
    const iframe = iframeRef.current;
    const container = containerRef.current;
    if (!iframe || !container) return;

    const markReady = () => {
      setLoaded(true);
      container.dispatchEvent(new CustomEvent("embedReady", { bubbles: true }));
    };

    iframe.addEventListener("load", markReady, { once: true });
    iframe.addEventListener("error", markReady, { once: true });

    const fallback = window.setTimeout(markReady, REDDIT_IFRAME_TIMEOUT);
    return () => {
      iframe.removeEventListener("load", markReady);
      iframe.removeEventListener("error", markReady);
      window.clearTimeout(fallback);
    };
  }, [embedSrc, resolving, failed, loaded]);

  // Reddit's official embed iframe posts its rendered height via postMessage.
  // Listen for it so the container hugs the actual content instead of leaving
  // a fixed-height gap underneath the action bar.
  useEffect(() => {
    if (!embedSrc) return;
    const onMessage = (event: MessageEvent) => {
      try {
        const origin = event.origin || "";
        if (!/\.reddit\.com$/i.test(new URL(origin).hostname)) return;
      } catch {
        return;
      }
      const data: any = event.data;
      if (!data || typeof data !== "object") return;
      // Accept any height-bearing message from reddit.com — the embed
      // sometimes fires bare `{height}` payloads after the "Read more"
      // toggle expands the body, without a recognisable `type`.
      const candidate =
        typeof data.height === "number"
          ? data.height
          : typeof data?.data?.height === "number"
          ? data.data.height
          : null;
      if (typeof candidate === "number" && candidate > 0) {
        let clamped = Math.min(REDDIT_EMBED_MAX_HEIGHT, Math.max(REDDIT_EMBED_MIN_HEIGHT, Math.ceil(candidate)));
        // For collapsed text posts, ignore Reddit's oversized initial
        // report and cap to the visible-preview size. Once the user taps
        // (userExpanded), follow Reddit's reported height so the card can
        // grow naturally.
        const isCollapsedText = mediaKind === 'text' && !userExpanded;
        const applied = isCollapsedText ? Math.min(clamped, COLLAPSED_TEXT_CAP) : clamped;
        if (!firstHeightLoggedRef.current) {
          firstHeightLoggedRef.current = true;
          console.log('[RedditEmbed] first-height', { postId, reported: Math.ceil(candidate), applied, mediaKind, userExpanded });
        } else {
          console.log('[RedditEmbed] resize', { postId, reported: Math.ceil(candidate), applied, userExpanded });
        }
        setIframeHeight(applied);
        if (!isCollapsedText) {
          persistHeight(applied, aspectRatio ?? null);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedSrc, persistHeight, aspectRatio, mediaKind, userExpanded, postId]);

  // Detect user interaction with the Reddit iframe (tap on "Read more",
  // upvote, etc.). Cross-origin iframes swallow events, but we can infer a
  // tap by watching window blur while the iframe is the activeElement.
  useEffect(() => {
    if (!embedSrc || mediaKind !== 'text' || userExpanded) return;
    const onBlur = () => {
      if (document.activeElement === iframeRef.current) {
        console.log('[RedditEmbed] user-expanded (iframe focus)', { postId });
        setUserExpanded(true);
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [embedSrc, mediaKind, userExpanded, postId]);

  if (resolving || (!resolvedUrl && !failed)) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: iframeHeight }} />;
  }

  if (!resolvedUrl || failed || !embedSrc) {
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
      ref={containerRef}
      className="relative w-full"
      style={{ height: iframeHeight }}
      data-embed-status={loaded ? "ready" : "loading"}
    >
      <iframe
        ref={iframeRef}
        src={embedSrc}
        title={title || "Reddit post"}
        width="640"
        height={iframeHeight}
        // Reddit's embed only postMessages a new height on initial render, not
        // reliably after the in-iframe "Read more" toggle. Falling back to
        // `auto` lets the expanded body scroll inside the card instead of
        // spilling out, while still letting the postMessage-driven grow path
        // run when Reddit does emit a resize.
        scrolling="auto"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="clipboard-read; clipboard-write"
        className="mx-auto block w-full h-full max-w-full rounded-lg border-0"
      />
    </div>
  );
}
