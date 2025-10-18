import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Heart, MessageCircle, UserPlus, Share2 } from "lucide-react";
import { useState } from "react";

const Notifications = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const notifications = [
    {
      id: 1,
      type: "like",
      user: "Sarah Chen",
      action: "liked your post",
      content: "Amazing design work!",
      time: "2m ago",
      icon: Heart,
      unread: true,
    },
    {
      id: 2,
      type: "comment",
      user: "Marcus Rodriguez",
      action: "commented on your post",
      content: "This is exactly what I needed. Thanks for sharing!",
      time: "15m ago",
      icon: MessageCircle,
      unread: true,
    },
    {
      id: 3,
      type: "follow",
      user: "Emily Park",
      action: "started following you",
      time: "1h ago",
      icon: UserPlus,
      unread: true,
    },
    {
      id: 4,
      type: "share",
      user: "David Kim",
      action: "shared your post",
      content: "Great insights on React patterns",
      time: "3h ago",
      icon: Share2,
      unread: false,
    },
    {
      id: 5,
      type: "like",
      user: "Alex Johnson",
      action: "liked your comment",
      time: "5h ago",
      icon: Heart,
      unread: false,
    },
    {
      id: 6,
      type: "comment",
      user: "Rachel Green",
      action: "replied to your comment",
      content: "Totally agree with your take on this!",
      time: "1d ago",
      icon: MessageCircle,
      unread: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        
        <div className="space-y-2">
          {notifications.map((notification) => {
            const Icon = notification.icon;
            return (
              <div 
                key={notification.id}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  notification.unread 
                    ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                    : 'bg-card hover:border-primary/50'
                }`}
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    notification.type === 'like' ? 'bg-red-100 text-red-500' :
                    notification.type === 'comment' ? 'bg-blue-100 text-blue-500' :
                    notification.type === 'follow' ? 'bg-green-100 text-green-500' :
                    'bg-purple-100 text-purple-500'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{notification.user}</span>{' '}
                      <span className="text-muted-foreground">{notification.action}</span>
                    </p>
                    {notification.content && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.content}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {notification.time}
                    </p>
                  </div>

                  {/* Unread indicator */}
                  {notification.unread && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav onCreatePost={() => setIsCreateDialogOpen(true)} />

      <CreatePostDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};

export default Notifications;
