import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, FileText } from "lucide-react";
import { maybeProxy } from "@/lib/getPostThumb";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { useDeleteDraft, type PostDraft } from "@/hooks/useDrafts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

interface DraftsGridProps {
  drafts: PostDraft[];
}

function DraftCard({
  draft,
  onOpen,
  onDelete,
}: {
  draft: PostDraft;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const platform = (draft.platform || "").toLowerCase();
  const icon = PLATFORM_ICONS[platform];
  const src = !imgError && draft.thumbnail_url ? maybeProxy(draft.thumbnail_url, 480) : null;

  return (
    <div className="relative group">
      <button
        onClick={onOpen}
        className="relative overflow-hidden rounded-2xl aspect-square bg-muted/50 w-full"
      >
        {src ? (
          <img
            src={src}
            alt=""
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
            <FileText className="w-8 h-8 text-muted-foreground/60 mb-1" />
            <span className="text-[10px] text-muted-foreground line-clamp-2 px-2 text-center">
              {draft.title || draft.caption || "Untitled draft"}
            </span>
          </div>
        )}
        {icon && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <img src={icon} alt="" className="w-3.5 h-3.5 invert" />
          </div>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete draft"
      >
        <Trash2 className="w-3.5 h-3.5 text-white" />
      </button>
    </div>
  );
}

export const DraftsGrid = ({ drafts }: DraftsGridProps) => {
  const [editingDraft, setEditingDraft] = useState<PostDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const deleteDraft = useDeleteDraft();

  if (drafts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-2">No drafts yet</p>
        <p className="text-sm text-muted-foreground">
          Save a post as draft to see it here
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {drafts.map((draft, i) => (
          <motion.div
            key={draft.id}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4), ease: [0.4, 0, 0.2, 1] }}
          >
            <DraftCard
              draft={draft}
              onOpen={() => setEditingDraft(draft)}
              onDelete={() => setPendingDelete(draft.id)}
            />
          </motion.div>
        ))}
      </div>

      {editingDraft && (
        <CreatePostDialog
          open={!!editingDraft}
          onOpenChange={(open) => { if (!open) setEditingDraft(null); }}
          initialDraft={editingDraft}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This draft will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteDraft.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
