import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  highlightCommentId?: string | null;
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
  canModerate = false,
  highlighted = false,
}: {
  comment: Comment;
  currentUserId?: string;
  onReply: (commentId: string, username: string) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
  canModerate?: boolean;
  highlighted?: boolean;
}) => {
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDelete, setShowDelete] = React.useState(false);

  const canDelete = currentUserId === comment.user_id || canModerate;
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlighted]);

  const handleTouchStart = () => {
    if (!canDelete) return;
    longPressTimer.current = setTimeout(() => setShowDelete(true), 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return (
    <div
      ref={ref}
      className={`flex gap-3 rounded-lg transition-colors ${isReply ? 'ml-12 mt-3' : ''} ${highlighted ? 'bg-primary/10 ring-1 ring-primary/30 p-2 -m-0.5' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={(e) => {
        if (canDelete) {
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
          {showDelete && canDelete && (
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
  canModerate = false,
  highlightCommentId,
}: {
  replies: Comment[];
  currentUserId?: string;
  onReply: (commentId: string, username: string) => void;
  onDelete: (commentId: string) => void;
  canModerate?: boolean;
  highlightCommentId?: string | null;
}) => {
  const shouldAutoExpand = !!highlightCommentId && replies.some((r) => r.id === highlightCommentId);
  const [expanded, setExpanded] = useState(shouldAutoExpand);

  React.useEffect(() => {
    if (shouldAutoExpand) setExpanded(true);
  }, [shouldAutoExpand]);

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
              canModerate={canModerate}
              highlighted={highlightCommentId === reply.id}
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

export const CommentsDialog = ({ open, onOpenChange, postId, postAuthorId, highlightCommentId }: CommentsDialogProps) => {
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const { comments, totalCount, isLoading, createComment, isCreating, deleteComment } = useComments(postId);
  const { data: canComment } = useCanInteract(postAuthorId, 'comment');
  const { user } = useSession();
  const isPostAuthor = !!user?.id && !!postAuthorId && user.id === postAuthorId;

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[100] p-0 rounded-t-2xl h-[85dvh] flex flex-col gap-0 border-t"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <SheetTitle className="text-center">Comments ({totalCount})</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3">
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
                      canModerate={isPostAuthor}
                      highlighted={highlightCommentId === c.id}
                    />
                    <RepliesSection
                      replies={c.replies || []}
                      currentUserId={user?.id}
                      onReply={handleReply}
                      onDelete={deleteComment}
                      canModerate={isPostAuthor}
                      highlightCommentId={highlightCommentId}
                    />
                  </div>
                ))}
              </div>
            )}
        </div>

        <div
          className="border-t bg-background flex-shrink-0 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
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
                rows={2}
                className="resize-none"
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
      </SheetContent>
    </Sheet>
  );
};
