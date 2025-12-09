import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Heart, MessageCircle, UserPlus, Share2, Bell } from "lucide-react";
import { useState } from "react";

const Notifications = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Real notifications will come from database - for now show empty state
  const notifications: Array<{
    id: string;
    type: string;
    user: string;
    action: string;
    content?: string;
    time: string;
    icon: typeof Heart;
    unread: boolean;
  }> = [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              When someone interacts with your posts, you'll see it here
            </p>
          </div>
        ) : (
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
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      notification.type === 'like' ? 'bg-red-100 text-red-500' :
                      notification.type === 'comment' ? 'bg-blue-100 text-blue-500' :
                      notification.type === 'follow' ? 'bg-green-100 text-green-500' :
                      'bg-purple-100 text-purple-500'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
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
                    {notification.unread && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
