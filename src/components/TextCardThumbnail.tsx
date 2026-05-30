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
import blogIcon from "@/assets/platforms/blog.svg";
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
};

// Brand-tinted gradients tuned for legibility of white text
const GRADIENTS: Record<string, string> = {
  instagram: "bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500",
  youtube: "bg-gradient-to-br from-red-700 to-red-500",
  x: "bg-gradient-to-br from-neutral-900 to-black",
  twitter: "bg-gradient-to-br from-neutral-900 to-black",
  threads: "bg-gradient-to-br from-neutral-900 to-black",
  spotify: "bg-gradient-to-br from-green-700 to-green-500",
  medium: "bg-gradient-to-br from-neutral-900 to-neutral-700",
  facebook: "bg-gradient-to-br from-blue-700 to-blue-500",
  linkedin: "bg-gradient-to-br from-[#0A66C2] to-[#1f86db]",
  reddit: "bg-gradient-to-br from-orange-700 to-orange-500",
  tiktok: "bg-gradient-to-br from-black to-neutral-800",
  pinterest: "bg-gradient-to-br from-red-800 to-red-600",
  quora: "bg-gradient-to-br from-red-900 to-red-700",
  article: "bg-gradient-to-br from-emerald-700 to-teal-500",
  external: "bg-gradient-to-br from-slate-700 to-slate-500",
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
  aspect?: string; // tailwind aspect class, e.g. "aspect-square" | "aspect-[3/4]"
  /** Max characters of text to display */
  maxChars?: number;
}

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
  aspect = "aspect-[3/4]",
  maxChars = 140,
}: TextCardThumbnailProps) {
  const key = (platform || "").toLowerCase();
  const icon = ICONS[key];
  const gradient = GRADIENTS[key] || GRADIENTS.external;
  const display = trimText(text, maxChars);

  return (
    <div
      className={`relative w-full h-full ${aspect} ${gradient} overflow-hidden`}
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
            className="text-white font-semibold text-center leading-snug break-words"
            style={{
              fontSize: "clamp(11px, 3.4cqw, 18px)",
              containerType: "inline-size",
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
        // No text at all — keep the brand mark centered, large
        <div className="absolute inset-0 grid place-items-center">
          {icon && (
            <img
              src={icon}
              alt=""
              className="w-12 h-12 opacity-70 invert"
            />
          )}
        </div>
      )}

      {/* Author handle */}
      {username && display && (
        <div className="absolute bottom-1.5 left-2 right-10">
          <span className="block text-[10px] text-white/80 font-medium truncate">
            @{username}
          </span>
        </div>
      )}

      {/* Platform badge — always top-right for consistency with image tiles */}
      {icon && display && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <img src={icon} alt="" className="w-3.5 h-3.5 invert" />
        </div>
      )}
    </div>
  );
}
