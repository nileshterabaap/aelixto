import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Heart, MessageCircle, Repeat2, Bell, Shield } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'like':
      return { icon: Heart, bgColor: 'bg-red-100', iconColor: 'text-red-500' };
    case 'comment':
      return { icon: MessageCircle, bgColor: 'bg-blue-100', iconColor: 'text-blue-500' };
    case 'repost':
      return { icon: Repeat2, bgColor: 'bg-green-100', iconColor: 'text-green-500' };
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
  const { icon: Icon, bgColor, iconColor } = getNotificationIcon(notification.type);
  const message = getNotificationMessage(notification.type);
  const actorName = notification.actor?.display_name || `@${notification.actor?.username}` || 'Someone';
  const isReportOutcome = notification.type === 'report_outcome';
  const outcome = notification.metadata?.action as 'removed' | 'kept' | undefined;
  const reportKind = notification.metadata?.kind as
    | 'report_outcome'
    | 'post_removed'
    | 'account_warning'
    | undefined;
  const isAuthorRemoval = reportKind === 'post_removed';
  const isAccountWarning = reportKind === 'account_warning';
  const snapshot = notification.metadata?.post_snapshot as
    | { title?: string; content?: string; thumbnail_url?: string }
    | undefined;
  
  const handleClick = () => {
    onClick();
  };

  return (
    <div 
      onClick={handleClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
        notification.is_read 
          ? 'bg-card hover:border-primary/50' 
          : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
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
                {isAccountWarning
                  ? 'Account warning'
                  : isAuthorRemoval
                  ? 'Your post was removed'
                  : outcome === 'removed'
                  ? 'Post removed'
                  : 'Report reviewed'}
              </span>{' '}
              <span className="text-muted-foreground">
                {isAccountWarning
                  ? '— a report against your account was upheld. Repeated violations may lead to account action.'
                  : isAuthorRemoval
                  ? '— it was reported and found to violate our community guidelines.'
                  : outcome === 'removed'
                  ? "— thanks for flagging it. We've taken it down."
                  : "— thanks for the report. We didn't find a violation this time."}
              </span>
            </p>
          ) : (
            <p className="text-sm">
              <span className="font-semibold">{actorName}</span>{' '}
              <span className="text-muted-foreground">{message}</span>
            </p>
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
  <div className="p-4 rounded-xl border bg-card">
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
    <div className="min-h-screen bg-background pb-20 relative">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />

      <div
        aria-hidden={!isLoading}
        className="absolute inset-x-0 top-0 z-20 pb-20 pointer-events-none transition-opacity duration-500 ease-out"
        style={{ opacity: isLoading ? 1 : 0 }}
      >
        <main className="mx-auto max-w-2xl px-4 py-6">
          <div className="h-8 w-40 bg-muted rounded-md mb-6 animate-shimmer" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>

      <div
        className="transition-[opacity,filter] duration-500 ease-out"
        style={{
          opacity: isLoading ? 0 : 1,
          filter: isLoading ? 'blur(8px)' : 'blur(0px)',
        }}
      >
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="mx-auto max-w-2xl px-4 py-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Notifications</h1>
          </div>

          {!isLoading && notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                When someone interacts with your posts, you'll see it here
              </p>
            </div>
          ) : !isLoading ? (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          ) : null}
        </main>
      </PullToRefresh>
      </div>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Notifications;
