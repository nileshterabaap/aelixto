import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Heart, MessageCircle, Repeat2, Bell, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
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
  onMarkAsRead,
  onClick 
}: { 
  notification: Notification; 
  onMarkAsRead: (id: string) => void;
  onClick: () => void;
}) => {
  const { icon: Icon, bgColor, iconColor } = getNotificationIcon(notification.type);
  const message = getNotificationMessage(notification.type);
  const actorName = notification.actor?.display_name || `@${notification.actor?.username}` || 'Someone';
  
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
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
          <p className="text-sm">
            <span className="font-semibold">{actorName}</span>{' '}
            <span className="text-muted-foreground">{message}</span>
          </p>
          {notification.post?.title && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              "{notification.post.title}"
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        {notification.post?.thumbnail_url && (
          <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted">
            <img 
              src={notification.post.thumbnail_url} 
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
  const { notifications, isLoading, markAllRead, markAsRead, isMarkingAllRead, refetch } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    } else if (notification.actor?.username) {
      navigate(`/u/${notification.actor.username}`);
    }
  };

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="mx-auto max-w-2xl px-4 py-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => markAllRead()}
                disabled={isMarkingAllRead}
                className="text-primary hover:text-primary"
              >
                <Check className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
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
                  onMarkAsRead={markAsRead}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </main>
      </PullToRefresh>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Notifications;
