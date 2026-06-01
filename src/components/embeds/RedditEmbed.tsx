import { useMemo } from "react";
import { ExternalLink, Play } from "lucide-react";
import redditIcon from "@/assets/platforms/reddit.svg";

type RedditEmbedProps = {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  authorAvatar?: string | null;
  content?: string | null;
  embedHtml?: string | null;
};

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

function decodeHtmlEntities(text: string): string {
  try {
    const doc = new DOMParser().parseFromString(text, "text/html");
    return doc.body.textContent || text;
  } catch {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}

function extractRedditTitle(embedHtml?: string | null): string | null {
  if (!embedHtml) return null;
  try {
    const doc = new DOMParser().parseFromString(embedHtml, "text/html");
    const postLink = doc.querySelector<HTMLAnchorElement>('a[href*="/comments/"]') || doc.querySelector<HTMLAnchorElement>("a");
    const text = postLink?.textContent?.replace(/\s+/g, " ").trim();
    return text || null;
  } catch {
    const match = embedHtml.match(/<a[^>]*>(.*?)<\/a>/i);
    return match?.[1] ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "")).trim() : null;
  }
}

function isGenericRedditTitle(value?: string | null): boolean {
  if (!value) return true;
  return /^(reddit post|open reddit post|reddit)$/i.test(value.trim());
}

function getDisplayTitle({ title, description, content, embedHtml }: Pick<RedditEmbedProps, "title" | "description" | "content" | "embedHtml">): string {
  const candidates = [
    extractRedditTitle(embedHtml),
    title,
    description,
    content,
  ];

  for (const candidate of candidates) {
    const clean = candidate?.replace(/\s+/g, " ").trim();
    if (clean && !isGenericRedditTitle(clean)) return clean;
  }

  return "Open on Reddit";
}

export default function RedditEmbed({ url, title, thumbnailUrl, description, authorAvatar, content, embedHtml }: RedditEmbedProps) {
  const safeUrl = useMemo(() => ensureProtocol(url), [url]);
  const displayTitle = useMemo(
    () => getDisplayTitle({ title, description, content, embedHtml }),
    [title, description, content, embedHtml]
  );
  const hasMediaPreview = !!thumbnailUrl && isMediaLikeUrl(thumbnailUrl);

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
              {displayTitle}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{getSafeHost(safeUrl)}</div>
          </div>
          <ExternalLink className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
        </div>
      </a>
    );
  }

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block w-full overflow-hidden border-y border-border bg-card text-foreground transition-colors hover:bg-accent"
      data-embed-status="ready"
    >
      <div
        className="relative flex min-h-[260px] items-center justify-center overflow-hidden px-6 py-10 text-center text-primary-foreground"
        style={{ background: "var(--thumb-gradient-reddit)" }}
      >
        <img
          src={redditIcon}
          alt=""
          className="absolute -left-8 -top-8 h-40 w-40 invert opacity-10"
          loading="lazy"
        />
        <img
          src={redditIcon}
          alt=""
          className="absolute -bottom-10 -right-8 h-44 w-44 invert opacity-10"
          loading="lazy"
        />
        <div className="relative z-[1] flex max-w-[20rem] flex-col items-center gap-4">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-background/15 shadow-sm ring-1 ring-primary-foreground/35 backdrop-blur-sm">
            <img src={redditIcon} alt="" className="h-12 w-12 invert" />
          </span>
          <div className="space-y-1">
            <div className="line-clamp-3 text-xl font-bold leading-snug">
              {displayTitle}
            </div>
            {description && description !== displayTitle ? (
              <p className="line-clamp-2 text-sm font-medium text-primary-foreground/85">{description}</p>
            ) : null}
            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary-foreground/85">
              <span>{getSafeHost(safeUrl)}</span>
              <ExternalLink className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
