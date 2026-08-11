import { useState } from "react";
import instagramIcon from "@/assets/platforms/instagram.svg";
import youtubeIcon from "@/assets/platforms/youtube.svg";
import xIcon from "@/assets/platforms/x.svg";
import spotifyIcon from "@/assets/platforms/spotify.svg";
import mediumIcon from "@/assets/platforms/medium.svg";
import threadsIcon from "@/assets/platforms/threads.svg";
import facebookIcon from "@/assets/platforms/facebook.svg";
import linkedinIcon from "@/assets/platforms/linkedin.svg";
import redditIcon from "@/assets/platforms/reddit.svg";
import tiktokIcon from "@/assets/platforms/tiktok.svg";
import pinterestIcon from "@/assets/platforms/pinterest.svg";
import quoraIcon from "@/assets/platforms/quora.svg";
import blogIcon from "@/assets/platforms/articles.svg";
import externalIcon from "@/assets/platforms/external.svg";

const ICONS: Record<string, string> = {
  instagram: instagramIcon,
  youtube: youtubeIcon,
  x: xIcon,
  twitter: xIcon,
  spotify: spotifyIcon,
  medium: mediumIcon,
  threads: threadsIcon,
  facebook: facebookIcon,
  linkedin: linkedinIcon,
  reddit: redditIcon,
  tiktok: tiktokIcon,
  pinterest: pinterestIcon,
  quora: quoraIcon,
  article: blogIcon,
  articles: blogIcon,
  external: externalIcon,
  link: externalIcon,
};

// Link-type posts (Quora / articles / external links) with no image should
// always fall back to their platform logo tile — never a text card.
const LOGO_ONLY = new Set(["quora", "article", "articles", "external", "link"]);

// Brand-tinted gradient tokens tuned for legibility and independent of Tailwind's generated class scan.
const GRADIENTS: Record<string, string> = {
  instagram: "var(--thumb-gradient-instagram)",
  youtube: "var(--thumb-gradient-youtube)",
  x: "var(--thumb-gradient-dark)",
  twitter: "var(--thumb-gradient-dark)",
  threads: "var(--thumb-gradient-dark)",
  spotify: "var(--thumb-gradient-spotify)",
  medium: "var(--thumb-gradient-dark)",
  facebook: "var(--thumb-gradient-facebook)",
  linkedin: "var(--thumb-gradient-linkedin)",
  reddit: "var(--thumb-gradient-reddit)",
  tiktok: "var(--thumb-gradient-dark)",
  pinterest: "var(--thumb-gradient-pinterest)",
  quora: "var(--thumb-gradient-quora)",
  article: "var(--thumb-gradient-article)",
  external: "var(--thumb-gradient-external)",
};

function trimText(t?: string | null, max = 140): string {
  if (!t) return "";
  const clean = t.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

interface TextCardThumbnailProps {
  platform?: string | null;
  text?: string | null;
  username?: string | null;
  displayName?: string | null;
  profileAvatarUrl?: string | null;
  preferProfile?: boolean;
  aspect?: string; // tailwind aspect class, e.g. "aspect-square" | "aspect-[3/4]"
  /** Max characters of text to display */
  maxChars?: number;
}

function initialsFromName(name?: string | null, username?: string | null): string {
  const source = (name || username || "A").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "Post on X",
  twitter: "Post on X",
  threads: "Threads",
  spotify: "Spotify",
  medium: "Medium",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  quora: "Quora",
  article: "Article",
};
PLATFORM_LABEL.articles = "Article";
PLATFORM_LABEL.external = "Link";
PLATFORM_LABEL.link = "Link";

/**
 * Typographic fallback thumbnail for text-only posts (Threads, X text,
 * LinkedIn, Reddit text, Quora). Renders the first slice of the post's
 * own text on a brand-tinted gradient with the platform logo badged in
 * the top-right corner. Keeps the grid visually balanced.
 */
export function TextCardThumbnail({
  platform,
  text,
  username,
  displayName,
  profileAvatarUrl,
  preferProfile = false,
  aspect = "aspect-[3/4]",
  maxChars = 140,
}: TextCardThumbnailProps) {
  const [avatarError, setAvatarError] = useState(false);
  const key = (platform || "").toLowerCase();
  const icon = ICONS[key];
  const gradient = GRADIENTS[key] || GRADIENTS.external;
  const logoOnly = LOGO_ONLY.has(key);
  const display = logoOnly ? "" : trimText(text, maxChars);
  const label = PLATFORM_LABEL[key] || "Post";
  const canShowProfile = !logoOnly && preferProfile && (!!profileAvatarUrl || !!displayName || !!username);
  const avatarSrc = profileAvatarUrl && !avatarError ? profileAvatarUrl : null;

  if (canShowProfile) {
    return (
      <div
        className="relative w-full h-full overflow-hidden bg-foreground"
        style={{ background: gradient }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-background font-bold text-4xl leading-none">
              {initialsFromName(displayName, username)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-foreground/10 pointer-events-none" />

        {icon && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-foreground/45 backdrop-blur-sm flex items-center justify-center">
            <img src={icon} alt="" className="w-3.5 h-3.5 invert" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-foreground"
      style={{ containerType: "inline-size", background: gradient }}
    >
      {/* Subtle paper-grain overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, white 0%, transparent 40%), radial-gradient(circle at 70% 80%, white 0%, transparent 40%)",
        }}
      />

      {/* Text content */}
      {display ? (
        <div className="absolute inset-0 flex items-center justify-center px-3">
          <span
            className="text-background font-semibold text-center leading-snug break-words"
            style={{
              fontSize: "clamp(11px, 3.4cqw, 18px)",
              display: "-webkit-box",
              WebkitLineClamp: 6,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}
          >
            {display}
          </span>
        </div>
      ) : (
        // No caption at all — show a clean branded card with logo + platform label
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
          {icon && (
            <img
              src={icon}
              alt=""
              className="w-10 h-10 opacity-95 invert"
            />
          )}
          <span className="text-[13px] text-background font-semibold tracking-wide">
            {label}
          </span>
          {username && (
            <span className="text-[11px] text-background/75 font-medium truncate max-w-[90%]">
              @{username}
            </span>
          )}
        </div>
      )}

      {/* Author handle */}
      {username && display && (
        <div className="absolute bottom-1.5 left-2 right-10">
          <span className="block text-[10px] text-background/80 font-medium truncate">
            @{username}
          </span>
        </div>
      )}

      {/* Platform badge — always top-right for consistency with image tiles */}
      {icon && display && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-foreground/40 backdrop-blur-sm flex items-center justify-center">
          <img src={icon} alt="" className="w-3.5 h-3.5 invert" />
        </div>
      )}
    </div>
  );
}
