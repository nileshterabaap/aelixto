import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pin, PinOff, Eye, EyeOff, MessageCircle, MessageCircleOff, Pencil, Trash2 } from "lucide-react";
import { usePostActions } from "@/hooks/usePostActions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  postId: string;
  userId: string;
  platform?: string | null;
  isPinned: boolean;
  hideCounts: boolean;
  commentsDisabled: boolean;
  isRepost?: boolean;
  currentCaption?: string;
  onDeleted?: () => void;
}

export const PostOwnerActionsSheet = ({
  open,
  onOpenChange,
  postId,
  userId,
  platform,
  isPinned,
  hideCounts,
  commentsDisabled,
  isRepost,
  currentCaption = "",
  onDeleted,
}: Props) => {
  const {
    togglePin,
    toggleHideCounts,
    toggleCommentsDisabled,
    editCaption,
    deletePost,
    isDeleting,
  } = usePostActions(postId, userId, { isRepost, onDeleted });

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(currentCaption);

  useEffect(() => {
    if (editOpen) setDraft(currentCaption);
  }, [editOpen, currentCaption]);

  const close = () => onOpenChange(false);

  const Row = ({ icon: Icon, label, onClick, destructive, disabled }: any) => (
    <button
      onClick={() => { onClick(); close(); }}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-5 py-4 text-left text-[15px] active:bg-muted disabled:opacity-50 ${destructive ? "text-destructive" : ""}`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="p-0 rounded-t-2xl max-h-[85vh] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted-foreground/30" />
          <div className="py-2 divide-y divide-border/50">
            {!isRepost && (
              <Row
                icon={isPinned ? PinOff : Pin}
                label={isPinned ? "Unpin from profile" : "Pin to profile"}
                onClick={() => togglePin({ pinned: !isPinned, platform })}
              />
            )}
            <Row
              icon={hideCounts ? Eye : EyeOff}
              label={hideCounts ? "Show interaction count" : "Hide interaction count"}
              onClick={() => toggleHideCounts(!hideCounts)}
            />
            <Row
              icon={commentsDisabled ? MessageCircle : MessageCircleOff}
              label={commentsDisabled ? "Turn on commenting" : "Turn off commenting"}
              onClick={() => toggleCommentsDisabled(!commentsDisabled)}
            />
            <Row
              icon={Pencil}
              label="Edit caption"
              onClick={() => { setEditOpen(true); }}
            />
            <Row
              icon={Trash2}
              label="Delete"
              destructive
              disabled={isDeleting}
              onClick={() => deletePost()}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit caption</DialogTitle>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            maxLength={2200}
            placeholder="Write a caption..."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => { editCaption(draft.trim()); setEditOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};