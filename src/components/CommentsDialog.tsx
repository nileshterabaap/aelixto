import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useComments } from "@/hooks/useComments";

interface CommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

export const CommentsDialog = ({ open, onOpenChange, postId }: CommentsDialogProps) => {
  const [comment, setComment] = useState("");
  const { comments, isLoading, createComment, isCreating } = useComments(postId);

  const handleSubmit = () => {
    if (!comment.trim()) return;
    createComment(comment);
    setComment("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments ({comments.length})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ScrollArea className="h-[300px] pr-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <img 
                      src={c.profiles?.avatar_url || "/placeholder.svg"} 
                      alt={c.profiles?.username || "User"}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {c.profiles?.display_name || c.profiles?.username || "Unknown"}
                      </p>
                      <p className="text-sm">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="space-y-2">
            <Textarea
              placeholder="Write a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <Button 
              onClick={handleSubmit} 
              disabled={!comment.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
