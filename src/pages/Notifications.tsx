import { Header } from "@/components/Header";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Heart, MessageCircle, Repeat2, Bell, Shield, UserPlus } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'like':
      return { icon: Heart, bgColor: 'bg-red-100', iconColor: 'text-red-500' };
    case 'comment':
      return { icon: MessageCircle, bgColor: 'bg-blue-100', iconColor: 'text-blue-500' };
    case 'repost':
      return { icon: Repeat2, bgColor: 'bg-green-100', iconColor: 'text-green-500' };
    case 'follow_request':
      return { icon: UserPlus, bgColor: 'bg-violet-100', iconColor: 'text-violet-500' };
    case 'report_outcome':
      return { icon: Shield, bgColor: 'bg-amber-100', iconColor: 'text-amber-600' };
    default:
      return { icon: Bell, bgColor: 'bg-muted', iconColor: 'text-muted-foreground' };
  }
};

const getNotificationMessage = (type: string) => {
  switch (type) {
    case 'like':
      return 'liked your post';
    case 'comment':
      return 'commented on your post';
    case 'repost':
      return 'reposted your post';
    case 'follow':
      return 'started following you';
    case 'follow_request':
      return 'asked to Follow';
    default:
      return 'interacted with you';
  }
};

const NotificationItem = ({ 
  notification, 
  onClick 
}: { 
  notification: Notification; 
  onClick: () => void;
}) => {
  const [busy, setBusy] = useState<"delete" | "keep" | null>(null);
  const [resolved, setResolved] = useState<"deleted" | "kept" | null>(null);
  const [reqBusy, setReqBusy] = useState<"approve" | "decline" | null>(null);
  const [reqResolved, setReqResolved] = useState<"approved" | "declined" | null>(null);
  const queryClient = useQueryClient();
  const { icon: Icon, bgColor, iconColor } = getNotificationIcon(notification.type);
  const message = getNotificationMessage(notification.type);
  const isReportOutcome = notification.type === 'report_outcome';
  const isFollowRequest = notification.type === 'follow_request';
  const actorName = isFollowRequest && notification.actor?.username
    ? `@${notification.actor.username}`
    : notification.actor?.display_name || `@${notification.actor?.username}` || 'Someone';
  const outcome = notification.metadata?.action as 'removed' | 'kept' | undefined;
  const reportKind = notification.metadata?.kind as
    | 'report_outcome'
    | 'post_removed'
    | 'account_warning'
    | 'source_removed'
    | undefined;
  const isAuthorRemoval = reportKind === 'post_removed';
  const isAccountWarning = reportKind === 'account_warning';
  const isSourceRemoved = reportKind === 'source_removed';
  const sourcePlatform = (notification.metadata?.platform as string | undefined) || '';
  const originalAuthor =
    (notification.metadata?.original_author as string | undefined) ||
    (notification.metadata?.post_snapshot as { original_author?: string } | undefined)?.original_author ||
    '';
  const snapshot = notification.metadata?.post_snapshot as
    | { title?: string; content?: string; thumbnail_url?: string }
    | undefined;
  
  const handleClick = () => {
    if (busy) return;
    onClick();
  };

  const handleApproveFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reqBusy || !notification.actor_id) return;
    setReqBusy("approve");
    const { error } = await supabase.rpc("respond_to_follow_request", {
      _requester: notification.actor_id,
      _approve: true,
    });
    if (error) {
      toast.error("Couldn't approve");
      setReqBusy(null);
      return;
    }
    setReqResolved("approved");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    setReqBusy(null);
  };

  const handleDeclineFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (reqBusy || !notification.actor_id) return;
    setReqBusy("decline");
    const { error } = await supabase.rpc("respond_to_follow_request", {
      _requester: notification.actor_id,
      _approve: false,
    });
    if (error) {
      toast.error("Couldn't decline");
      setReqBusy(null);
      return;
    }
    setReqResolved("declined");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    setReqBusy(null);
  };

  const handleDeletePost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || !notification.post_id) return;
    setBusy("delete");
    const { error } = await supabase.from("posts").delete().eq("id", notification.post_id);
    if (error) {
      toast.error("Couldn't delete the post");
      setBusy(null);
      return;
    }
    toast.success("Post deleted from your profile");
    setResolved("deleted");
    setBusy(null);
  };

  const handleKeepPost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setResolved("kept");
  };

  return (
    <div 
      onClick={handleClick}
      className={`glass-post-card p-4 rounded-xl cursor-pointer transition-all duration-200 ${
        notification.is_read ? '' : 'ring-1 ring-primary/20'
      }`}
    >
      <div className="flex gap-3">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          {isReportOutcome ? (
            <p className="text-sm">
              <span className="font-semibold">
                {isSourceRemoved
                  ? 'Your post was removed'
                  : isAccountWarning
                  ? 'Account warning'
                  : isAuthorRemoval
                  ? 'Your post was removed'
                  : outcome === 'removed'
                  ? 'Post removed'
                  : 'Report reviewed'}
              </span>{' '}
              <span className="text-muted-foreground">
                {isSourceRemoved
                  ? `— the original ${sourcePlatform ? sourcePlatform.charAt(0).toUpperCase() + sourcePlatform.slice(1) + ' ' : ''}post was deleted or made private at the source.`
                  : isAccountWarning
                  ? '— a report against your account was upheld. Repeated violations may lead to account action.'
                  : isAuthorRemoval
                  ? '— it was reported and found to violate our community guidelines.'
                  : outcome === 'removed'
                  ? "— thanks for flagging it. We've taken it down."
                  : "— thanks for the report. We didn't find a violation this time."}
              </span>
            </p>
          ) : null}
          {isSourceRemoved && (originalAuthor || snapshot?.title) && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {originalAuthor ? <>by <span className="font-medium text-foreground">@{originalAuthor}</span></> : null}
              {originalAuthor && snapshot?.title ? ' · ' : ''}
              {snapshot?.title ? <span className="italic">"{snapshot.title.slice(0, 60)}{snapshot.title.length > 60 ? '…' : ''}"</span> : null}
            </p>
          )}
          {isSourceRemoved && notification.post_id && (
            <div className="flex gap-2 mt-3">
              {resolved === "deleted" ? (
                <span className="text-xs text-muted-foreground">Removed from your profile.</span>
              ) : resolved === "kept" ? (
                <span className="text-xs text-muted-foreground">Kept on your profile.</span>
              ) : (
                <>
                  <button
                    onClick={handleDeletePost}
                    disabled={busy !== null}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    {busy === "delete" ? "Deleting…" : "Delete post"}
                  </button>
                  <button
                    onClick={handleKeepPost}
                    disabled={busy !== null}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition disabled:opacity-50"
                  >
                    Keep
                  </button>
                </>
              )}
            </div>
          )}
          {!isReportOutcome && (
            <p className="text-sm">
              <span className="font-semibold">{actorName}</span>{' '}
              <span className="text-muted-foreground">{message}</span>
            </p>
          )}
          {isFollowRequest && (
            <div className="flex gap-2 mt-3">
              {reqResolved === "approved" ? (
                <span className="text-xs text-muted-foreground">Approved.</span>
              ) : reqResolved === "declined" ? (
                <span className="text-xs text-muted-foreground">Declined.</span>
              ) : (
                <>
                  <button
                    onClick={handleApproveFollow}
                    disabled={reqBusy !== null}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50"
                  >
                    {reqBusy === "approve" ? "Alright…" : "Alright"}
                  </button>
                  <button
                    onClick={handleDeclineFollow}
                    disabled={reqBusy !== null}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition disabled:opacity-50"
                  >
                    {reqBusy === "decline" ? "Sorry…" : "Sorry"}
                  </button>
                </>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        {(notification.post?.thumbnail_url || snapshot?.thumbnail_url) && (
          <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden bg-muted">
            <img 
              src={notification.post?.thumbnail_url || snapshot?.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {!notification.is_read && (
          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
        )}
      </div>
    </div>
  );
};

const NotificationSkeleton = () => (
  <div className="glass-post-card p-4 rounded-xl">
    <div className="flex gap-3">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  </div>
);

const Notifications = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  useCreatePostTrigger(useCallback(() => setIsCreateDialogOpen(true), []));
  const { notifications, isLoading, markAllRead, refetch } = useNotifications();
  const navigate = useNavigate();

  // Auto mark all as read when user opens the notifications page
  useEffect(() => {
    if (!isLoading && notifications.some((n) => !n.is_read)) {
      markAllRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === 'report_outcome') return; // no navigation for moderation outcomes
    if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    } else if (notification.actor?.username) {
      navigate(`/u/${notification.actor.username}`);
    }
  };

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="mx-auto max-w-2xl px-4 py-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Notifications</h1>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                When someone interacts with your posts, you'll see it here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </main>
      </PullToRefresh>


      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Notifications;
