import { useMemo } from "react";
import { ExternalLink, Play } from "lucide-react";
import redditIcon from "@/assets/platforms/reddit.svg";

type RedditEmbedProps = {
  url: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
  authorAvatar?: string | null;
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

export default function RedditEmbed({ url, title, thumbnailUrl, description, authorAvatar }: RedditEmbedProps) {
  const previewImage = thumbnailUrl || authorAvatar || undefined;
  const safeUrl = useMemo(() => ensureProtocol(url), [url]);
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
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block w-full overflow-hidden border-y border-border bg-card text-foreground transition-colors hover:bg-accent"
      data-embed-status="ready"
    >
      <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden bg-muted px-6 py-8 text-center">
        {previewImage ? (
          <img
            src={previewImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm"
            loading="lazy"
          />
        ) : null}
        <div className="relative z-[1] flex max-w-[18rem] flex-col items-center gap-3">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-background/90 shadow-sm ring-1 ring-border">
            <img src={redditIcon} alt="" className="h-10 w-10" />
          </span>
          <div className="space-y-1">
            <div className="line-clamp-3 text-base font-semibold leading-snug">
              {title || description || "Open Reddit post"}
            </div>
            {title && description ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
            ) : null}
            <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span>{getSafeHost(safeUrl)}</span>
              <ExternalLink className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
