import { useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const conversations = [
  {
    id: 1,
    username: "Sarah Johnson",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    lastMessage: "That's amazing! Can't wait to see it",
    timestamp: "2m",
    unread: true,
  },
  {
    id: 2,
    username: "Michael Chen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    lastMessage: "Thanks for sharing! 🔥",
    timestamp: "15m",
    unread: true,
  },
  {
    id: 3,
    username: "Emma Davis",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    lastMessage: "Let me know when you're free",
    timestamp: "1h",
    unread: false,
  },
  {
    id: 4,
    username: "Alex Kim",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    lastMessage: "You: See you tomorrow!",
    timestamp: "3h",
    unread: false,
  },
  {
    id: 5,
    username: "Lisa Anderson",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
    lastMessage: "Perfect timing 👌",
    timestamp: "5h",
    unread: false,
  },
];

const Messages = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onCreatePost={() => setIsCreateDialogOpen(true)} />
      
      <main className="container max-w-2xl mx-auto px-4 py-6">
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
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                conversation.unread ? "bg-accent/50" : ""
              }`}
            >
              <div className="relative">
                <div className="h-14 w-14 rounded-full overflow-hidden bg-muted">
                  <img
                    src={conversation.avatar}
                    alt={conversation.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                {conversation.unread && (
                  <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`font-semibold truncate ${
                    conversation.unread ? "text-foreground" : "text-foreground/80"
                  }`}>
                    {conversation.username}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {conversation.timestamp}
                  </span>
                </div>
                <p className={`text-sm truncate ${
                  conversation.unread ? "text-foreground font-medium" : "text-muted-foreground"
                }`}>
                  {conversation.lastMessage}
                </p>
              </div>
            </div>
          ))}
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

export default Messages;
