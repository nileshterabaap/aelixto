import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import React, { useState } from "react";
import { useComments, type Comment } from "@/hooks/useComments";
import { UsernameLink, parseTextWithMentions } from "@/components/UsernameLink";
import { useCanInteract } from "@/hooks/useInteractionPermissions";
import { useSession } from "@/hooks/useSession";
import { Trash2, Reply, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

interface CommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postAuthorId?: string;
}

const timeAgo = (date: string) => {
  const str = formatDistanceToNowStrict(new Date(date), { addSuffix: false });
  return str
    .replace(' seconds', 's').replace(' second', 's')
    .replace(' minutes', 'm').replace(' minute', 'm')
    .replace(' hours', 'h').replace(' hour', 'h')
    .replace(' days', 'd').replace(' day', 'd')
    .replace(' weeks', 'w').replace(' week', 'w')
    .replace(' months', 'mo').replace(' month', 'mo')
    .replace(' years', 'y').replace(' year', 'y');
};

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
}) => {
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDelete, setShowDelete] = React.useState(false);

  const handleTouchStart = () => {
    if (currentUserId !== comment.user_id) return;
    longPressTimer.current = setTimeout(() => setShowDelete(true), 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div
      className={`flex gap-3 ${isReply ? 'ml-12 mt-3' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={(e) => {
        if (currentUserId === comment.user_id) {
          e.preventDefault();
          setShowDelete(true);
        }
      }}
    >
      <img 
        src={comment.profiles?.avatar_url || "/placeholder.svg"} 
        alt={comment.profiles?.username || "User"}
        className={`${isReply ? 'h-7 w-7' : 'h-9 w-9'} rounded-full object-cover flex-shrink-0`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <UsernameLink 
            username={comment.profiles?.username || "unknown"}
            className="font-semibold text-sm"
          >
            {comment.profiles?.username || "unknown"}
          </UsernameLink>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-sm mt-0.5">{parseTextWithMentions(comment.content)}</p>
        <div className="flex items-center gap-4 mt-1">
          <button
            onClick={() => onReply(
              isReply ? comment.parent_id! : comment.id,
              comment.profiles?.username || "unknown"
            )}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Reply
          </button>
          {showDelete && currentUserId === comment.user_id && (
            <button
              onClick={() => { onDelete(comment.id); setShowDelete(false); }}
              className="text-xs font-semibold text-destructive animate-in fade-in duration-150"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const RepliesSection = ({
  replies,
  currentUserId,
  onReply,
  onDelete,
}: {
  replies: Comment[];
  currentUserId?: string;
  onReply: (commentId: string, username: string) => void;
  onDelete: (commentId: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!replies || replies.length === 0) return null;

  return (
    <div className="ml-12 mt-2">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-2"
        >
          <span className="w-6 h-px bg-muted-foreground/40 inline-block" />
          View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </button>
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              isReply
            />
          ))}
          <button
            onClick={() => setExpanded(false)}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-2"
          >
            <span className="w-6 h-px bg-muted-foreground/40 inline-block" />
            Hide replies
          </button>
        </div>
      )}
    </div>
  );
};

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
          <ScrollArea className="h-[350px] pr-4">
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
                    <RepliesSection
                      replies={c.replies || []}
                      currentUserId={user?.id}
                      onReply={handleReply}
                      onDelete={deleteComment}
                    />
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
