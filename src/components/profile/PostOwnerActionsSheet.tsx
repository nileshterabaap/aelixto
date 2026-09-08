import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pin, PinOff, Eye, EyeOff, MessageCircle, MessageCircleOff, Pencil, Trash2 } from "lucide-react";
import { usePostActions } from "@/hooks/usePostActions";
import { supabase } from "@/integrations/supabase/client";

const SKIP_KEY = "aelixto_skip_delete_score_warning";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);

  useEffect(() => {
    if (editOpen) setDraft(currentCaption);
  }, [editOpen, currentCaption]);

  const close = () => onOpenChange(false);

  // Show the score-deduction warning only for in-cycle posts that actually earned score.
  const requestDelete = async () => {
    const plainDelete = () => { deletePost(); close(); };
    if (isRepost) return plainDelete();
    try {
      if (localStorage.getItem(SKIP_KEY) === "1") return plainDelete();
      const { data } = await supabase.rpc("post_delete_score_preview", {
        p_post_id: postId,
      });
      const eligible = !!(data as any)?.eligible;
      if (eligible) {
        setDontAsk(false);
        setConfirmOpen(true);
        return;
      }
    } catch {
      // fall through to plain delete
    }
    plainDelete();
  };

  const Row = ({ icon: Icon, label, onClick, destructive, disabled, noClose }: any) => (
    <button
      onClick={() => { onClick(); if (!noClose) close(); }}
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
          className="p-0 rounded-t-2xl max-h-[85vh] pb-[var(--safe-bottom)]"
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
              noClose
              onClick={() => requestDelete()}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Post?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deleting this post before the next slot cycle will also deduct the Aelix Score
            gained by this post. Continue?
          </p>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={dontAsk} onCheckedChange={(v) => setDontAsk(!!v)} />
            <span>Don't ask again</span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                if (dontAsk) {
                  try { localStorage.setItem(SKIP_KEY, "1"); } catch { /* ignore */ }
                }
                setConfirmOpen(false);
                deletePost();
                close();
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};