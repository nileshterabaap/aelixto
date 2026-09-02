import { SwipeableView } from "@/components/SwipeableView";
import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Trash2 } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { formatDistanceToNow } from "date-fns";
import { useSession } from "@/hooks/useSession";
import { MessagesSkeleton } from "@/components/messages/MessagesSkeleton";
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
import { useToast } from "@/hooks/use-toast";

const Messages = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));
  const navigate = useNavigate();
  const { conversations, loading, refetch, deleteConversation } = useConversations();
  const { user } = useSession();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const startLongPress = (conversationId: string) => {
    longPressFired.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (navigator.vibrate) navigator.vibrate(15);
      setPendingDelete(conversationId);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteConversation(id);
      toast({ title: "Chat deleted" });
    } catch {
      toast({
        title: "Couldn't delete chat",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatTimestamp = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const handleRefresh = useCallback(async () => {
    await refetch?.();
  }, [refetch]);

  return (
    <SwipeableView leftRoute="/" leftLabel="Home">
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="container max-w-2xl mx-auto px-4 py-6 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6">Messages</h2>
          
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              className="pl-10"
            />
          </div>

          {/* Conversations List */}
          {loading ? (
            <MessagesSkeleton />
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation, i) => {
                const hasUnread = conversation.unread_count > 0;
                const rawContent = conversation.last_message?.content || "";
                // Strip reply prefix: "↪️__REPLY__:<uuid>\n<body>"
                const replyStripped = rawContent.replace(
                  /^↪️__REPLY__:[a-f0-9-]{36}\n?/,
                  ""
                );
                const isPostShare = /^https?:\/\/.+\/post\/[a-f0-9-]{36}$/.test(
                  replyStripped.trim()
                );
                const isPhoto = replyStripped.trim().startsWith("🖼️__IMAGE__:");
                const isVideo = replyStripped.trim().startsWith("🎞️__VIDEO__:");
                const displayContent = isPostShare
                  ? "Sent a post"
                  : isPhoto
                    ? "Sent a photo"
                    : isVideo
                      ? "Sent a video"
                      : replyStripped;
                const lastMessagePreview = conversation.last_message
                  ? conversation.last_message.sender_id === user?.id
                    ? `You: ${displayContent}`
                    : displayContent
                  : "No messages yet";

                return (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.5), ease: [0.4, 0, 0.2, 1] }}
                    className={`press-in flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                      hasUnread ? "bg-accent/50" : ""
                    }`}
                    onClick={() => {
                      if (longPressFired.current) {
                        longPressFired.current = false;
                        return;
                      }
                      navigate(`/conversation/${conversation.id}`);
                    }}
                    onTouchStart={() => startLongPress(conversation.id)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    onPointerDown={(e) => {
                      if (e.pointerType === "mouse") startLongPress(conversation.id);
                    }}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setPendingDelete(conversation.id);
                    }}
                    style={{ WebkitTouchCallout: "none" }}
                  >
                    <div className="relative">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={conversation.other_user.avatar_url || undefined} />
                        <AvatarFallback>
                          {(conversation.other_user.display_name || conversation.other_user.username)
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {hasUnread && (
                        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground font-medium">
                          {conversation.unread_count}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold truncate ${
                          hasUnread ? "text-foreground" : "text-foreground/80"
                        }`}>
                          {conversation.other_user.display_name || conversation.other_user.username}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {conversation.last_message
                            ? formatTimestamp(conversation.last_message.created_at)
                            : formatTimestamp(conversation.updated_at)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${
                        hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}>
                        {lastMessagePreview}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </PullToRefresh>

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete chat?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the conversation and all its messages for both of you. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </SwipeableView>
  );
};

export default Messages;
