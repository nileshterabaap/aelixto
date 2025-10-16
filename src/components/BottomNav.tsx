// PostCard.tsx — Aelixto mock-accurate card with outlined action buttons.
// Uses Tailwind + lucide-react. No extra deps beyond your project defaults.

import {
  MoreHorizontal,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
} from "lucide-react";

type PostCardProps = {
  avatarUrl: string;
  username: string;   // e.g., "alex_r"
  imageUrl: string;   // post media preview
  onLike?: () => void;
  onComment?: () => void;
  onRepost?: () => void;
  onShare?: () => void;
  onSave?: () => void;
};

export default function PostCard({
  avatarUrl,
  username,
  imageUrl,
  onLike,
  onComment,
  onRepost,
  onShare,
  onSave,
}: PostCardProps) {
  return (
    <article className="mx-auto max-w-md px-4">
      {/* Outer rounded card with thin black border (as in your mock) */}
      <div className="rounded-[28px] border border-black px-4 pt-4 pb-3 mb-6 bg-white">
        {/* Header: avatar, username, menu */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-1 ring-black/5"
            />
            <span className="font-semibold text-lg text-black leading-none">
              {username}
            </span>
          </div>
          <MoreHorizontal className="h-6 w-6 stroke-[2.5] text-black" />
        </div>

        {/* Media with large rounded corners */}
        <div className="overflow-hidden rounded-[20px]">
          <img src={imageUrl} alt="" className="w-full h-auto object-cover" />
        </div>

        {/* ----- ACTION BUTTONS (mock replicated) ----- */}
        <div className="mt-6 mb-1 flex items-center justify-between">
          {/* Left group: heart, comment, repost, share */}
          <div className="flex items-center gap-7">
            <button
              aria-label="Like"
              onClick={onLike}
              className="active:scale-95 transition-transform"
            >
              <Heart className="h-8 w-8 stroke-[2.75] text-black" />
            </button>

            <button
              aria-label="Comment"
              onClick={onComment}
              className="active:scale-95 transition-transform"
            >
              <MessageCircle className="h-8 w-8 stroke-[2.75] text-black" />
            </button>

            <button
              aria-label="Repost"
              onClick={onRepost}
              className="active:scale-95 transition-transform"
            >
              <Repeat2 className="h-8 w-8 stroke-[2.75] text-black" />
            </button>

            <button
              aria-label="Share"
              onClick={onShare}
              className="active:scale-95 transition-transform"
            >
              <Share2 className="h-8 w-8 stroke-[2.75] text-black" />
            </button>
          </div>

          {/* Right: bookmark */}
          <button
            aria-label="Save"
            onClick={onSave}
            className="active:scale-95 transition-transform"
          >
            <Bookmark className="h-8 w-8 stroke-[2.75] text-black" />
          </button>
        </div>
        {/* ------------------------------------------- */}
      </div>
    </article>
  );
}