import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useComments, type Comment } from "@/hooks/useComments";
import { UsernameLink, parseTextWithMentions } from "@/components/UsernameLink";
import { useCanInteract } from "@/hooks/useInteractionPermissions";
import { useSession } from "@/hooks/useSession";
import { Trash2, Reply, X } from "lucide-react";

interface CommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postAuthorId?: string;
}

const CommentItem = ({
  comment,
  currentUserId,
  onReply,
  onDelete,
  isReply = false,
}: {
  comment: Comment;
  currentUserId?: string;
  onReply: (commentId: string, username: string) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}) => (
  <div className={`flex gap-3 ${isReply ? 'ml-8 mt-2' : ''}`}>
    <img 
      src={comment.profiles?.avatar_url || "/placeholder.svg"} 
      alt={comment.profiles?.username || "User"}
      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
    />
    <div className="flex-1 min-w-0">
      <UsernameLink 
        username={comment.profiles?.username || "unknown"}
        className="font-semibold text-sm"
      >
        {comment.profiles?.display_name || comment.profiles?.username || "Unknown"}
      </UsernameLink>
      <p className="text-sm mt-0.5">{parseTextWithMentions(comment.content)}</p>
      <div className="flex items-center gap-3 mt-1">
        {!isReply && (
          <button
            onClick={() => onReply(comment.id, comment.profiles?.username || "unknown")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
        )}
        {currentUserId === comment.user_id && (
          <button
            onClick={() => onDelete(comment.id)}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        )}
      </div>
    </div>
  </div>
);

export const CommentsDialog = ({ open, onOpenChange, postId, postAuthorId }: CommentsDialogProps) => {
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const { comments, totalCount, isLoading, createComment, isCreating, deleteComment } = useComments(postId);
  const { data: canComment } = useCanInteract(postAuthorId, 'comment');
  const { user } = useSession();

  const handleSubmit = () => {
    if (!comment.trim()) return;
    createComment(comment, replyTo?.id);
    setComment("");
    setReplyTo(null);
  };

  const handleReply = (commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
    setComment(`@${username} `);
  };

  const commentDisabled = canComment && !canComment.allowed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments ({totalCount})</DialogTitle>
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
                  <div key={c.id}>
                    <CommentItem
                      comment={c}
                      currentUserId={user?.id}
                      onReply={handleReply}
                      onDelete={deleteComment}
                    />
                    {c.replies?.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        currentUserId={user?.id}
                        onReply={handleReply}
                        onDelete={deleteComment}
                        isReply
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {commentDisabled ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              {canComment?.reason || 'Comments are disabled'}
            </p>
          ) : (
            <div className="space-y-2">
              {replyTo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                  <Reply className="h-3 w-3" />
                  <span>Replying to @{replyTo.username}</span>
                  <button onClick={() => { setReplyTo(null); setComment(""); }} className="ml-auto">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <Textarea
                placeholder={replyTo ? `Reply to @${replyTo.username}...` : "Write a comment..."}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <Button 
                onClick={handleSubmit} 
                disabled={!comment.trim() || isCreating}
                className="w-full"
              >
                {isCreating ? "Posting..." : replyTo ? "Reply" : "Post Comment"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
