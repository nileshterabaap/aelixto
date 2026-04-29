import { useState } from "react";
import { motion } from "framer-motion";
import { getPostThumb, maybeProxy } from "@/lib/getPostThumb";
import { SavedPostViewer } from "@/components/saved/SavedPostViewer";
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

const PLATFORM_ICONS: Record<string, string> = {
  instagram: instagramIcon, youtube: youtubeIcon, x: xIcon, twitter: xIcon,
  spotify: spotifyIcon, medium: mediumIcon, threads: threadsIcon,
  facebook: facebookIcon, linkedin: linkedinIcon, reddit: redditIcon, tiktok: tiktokIcon,
};

const PLATFORM_GRADIENTS: Record<string, string> = {
  instagram: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400",
  youtube: "bg-gradient-to-br from-red-600 to-red-400",
  x: "bg-black", twitter: "bg-black",
  spotify: "bg-gradient-to-br from-green-600 to-green-400",
  medium: "bg-gradient-to-br from-gray-900 to-gray-700",
  threads: "bg-black",
  facebook: "bg-gradient-to-br from-blue-600 to-blue-400",
  linkedin: "bg-gradient-to-br from-blue-700 to-blue-500",
  reddit: "bg-gradient-to-br from-orange-600 to-orange-400",
  tiktok: "bg-gradient-to-br from-black to-gray-800",
  article: "bg-gradient-to-br from-emerald-600 to-teal-400",
  external: "bg-gradient-to-br from-gray-600 to-gray-400",
};

export interface SavedPost {
  id: string;
  user_id: string;
  content: string;
  title: string;
  mediaType?: string;
  mediaUrl?: string;
  platform?: string;
  embed_html?: string;
  thumbnail_url?: string;
  timestamp: Date;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  author: { name: string; username: string; avatar: string };
  isRealPost: boolean;
}

interface SavedThumbnailGridProps {
  posts: SavedPost[];
  userId?: string;
}

function ThumbnailCard({ post, onClick }: { post: SavedPost; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const rawThumb = getPostThumb({ platform: post.platform, thumbnail_url: post.thumbnail_url, media_url: post.mediaUrl });
  const src = imgError ? null : maybeProxy(rawThumb, 480);
  const platform = (post.platform || "").toLowerCase();
  const icon = PLATFORM_ICONS[platform];
  const gradient = PLATFORM_GRADIENTS[platform] || "bg-muted";

  if (!src || src === "/placeholder.svg") {
    return (
      <button onClick={onClick} className={`relative overflow-hidden rounded-2xl aspect-square ${gradient} flex items-center justify-center`}>
        {icon && <img src={icon} alt="" className="w-10 h-10 opacity-60 invert" />}
        {post.title && (
          <span className="absolute bottom-2 left-2 right-2 text-[10px] text-white/80 line-clamp-2 text-left font-medium">{post.title}</span>
        )}
      </button>
    );
  }

  return (
    <button onClick={onClick} className="relative overflow-hidden rounded-2xl aspect-square bg-muted/50 group">
      <img src={src} alt="" onError={() => setImgError(true)} className="w-full h-full object-cover" loading="lazy" />
      {icon && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <img src={icon} alt="" className="w-3.5 h-3.5 invert" />
        </div>
      )}
    </button>
  );
}

export const SavedThumbnailGrid = ({ posts, userId }: SavedThumbnailGridProps) => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-2">No saved posts yet</p>
        <p className="text-sm text-muted-foreground">Save posts to see them here</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {posts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4), ease: [0.4, 0, 0.2, 1] }}
          >
            <ThumbnailCard post={post} onClick={() => setSelectedPostId(post.id)} />
          </motion.div>
        ))}
      </div>

      {selectedPostId && (
        <SavedPostViewer
          posts={posts}
          initialPostId={selectedPostId}
          userId={userId}
          onClose={() => setSelectedPostId(null)}
        />
      )}
    </>
  );
};
