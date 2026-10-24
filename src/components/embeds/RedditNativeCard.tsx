import { useState } from "react";
import { ArrowBigUp, MessageCircle, ExternalLink } from "lucide-react";
import redditIcon from "@/assets/platforms/reddit.svg";
import { formatCompactCount } from "@/lib/formatCount";
import type { RedditPostData } from "@/lib/redditPostData";

const timeAgo = (utc: number | null) => {
  if (!utc) return "";
  const s = Math.max(0, Date.now() / 1000 - utc);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo`;
  return `${Math.floor(s / (86400 * 365))}y`;
};

const ratioStyle = (w: number | null, h: number | null) =>
  w && h ? { aspectRatio: `${w} / ${h}`, maxHeight: 640 } : { maxHeight: 640 };

/** Reddit-style post card drawn by the app itself (iPhone app only). */
export function RedditNativeCard({ data }: { data: RedditPostData }) {
  const [revealed, setRevealed] = useState(!data.nsfw);
  const [slide, setSlide] = useState(0);
  const { media } = data;

  return (
    <div className="w-full bg-card text-foreground" data-embed-status="ready">
      <a href={data.permalink} target="_blank" rel="noopener noreferrer" className="block px-4 pt-3">
        <div className="flex items-center gap-2.5">
          <img
            src={data.subredditIcon || redditIcon}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full bg-muted object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = redditIcon; }}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold">r/{data.subreddit}</div>
            <div className="truncate text-xs text-muted-foreground">
              u/{data.author}{data.createdUtc ? ` · ${timeAgo(data.createdUtc)}` : ""}
            </div>
          </div>
          <img src={redditIcon} alt="Reddit" className="h-6 w-6 shrink-0" />
        </div>
        {data.title ? (
          <div className="mt-2.5 text-[17px] font-semibold leading-snug break-words">{data.title}</div>
        ) : null}
        {data.selftext ? (
          <div className="mt-1.5 line-clamp-6 whitespace-pre-line text-sm text-muted-foreground break-words">
            {data.selftext}
          </div>
        ) : null}
        {data.externalDomain && media.type !== "video" ? (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            {data.externalDomain}
          </div>
        ) : null}
      </a>

      {media.type !== "none" ? (
        <div className="relative mt-3 w-full overflow-hidden bg-muted">
          {media.type === "video" ? (
            <video
              src={media.hlsUrl}
              poster={media.poster || undefined}
              controls
              playsInline
              preload="metadata"
              className="block w-full bg-muted object-contain"
              style={ratioStyle(media.width, media.height)}
            />
          ) : media.images.length === 1 ? (
            <img
              src={media.images[0].url}
              alt={data.title || "Reddit post"}
              className="block w-full object-contain"
              style={ratioStyle(media.images[0].width, media.images[0].height)}
              loading="lazy"
            />
          ) : (
            <>
              <div
                className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
                }}
              >
                {media.images.map((img, i) => (
                  <img
                    key={img.url + i}
                    src={img.url}
                    alt=""
                    className="block w-full shrink-0 snap-center object-contain"
                    style={ratioStyle(media.images[0].width, media.images[0].height)}
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium">
                {slide + 1}/{media.images.length}
              </div>
            </>
          )}
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="absolute inset-0 flex items-center justify-center bg-muted/70 text-sm font-medium backdrop-blur-2xl"
            >
              Sensitive content · Tap to view
            </button>
          ) : null}
        </div>
      ) : null}

      <a
        href={data.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 px-4 py-2.5 text-xs text-muted-foreground"
      >
        {data.score !== null ? (
          <span className="inline-flex items-center gap-1">
            <ArrowBigUp className="h-4 w-4" />
            {formatCompactCount(data.score)}
          </span>
        ) : null}
        {data.numComments !== null ? (
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {formatCompactCount(data.numComments)}
          </span>
        ) : null}
        <span className="ml-auto font-medium">View on Reddit</span>
      </a>
    </div>
  );
}
