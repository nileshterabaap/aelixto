import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface CommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

export const CommentsDialog = ({ open, onOpenChange, postId }: CommentsDialogProps) => {
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    // TODO: Implement comment submission when comments table is added
    setComment("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Comments feature coming soon!
          </div>
          <Textarea
            placeholder="Write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button onClick={handleSubmit} disabled>
            Post Comment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
