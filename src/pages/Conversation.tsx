import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedPostCard } from "@/components/messages/SharedPostCard";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMessages } from "@/hooks/useMessages";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

interface ConversationUser {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

const Conversation = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { messages, loading, sendMessage } = useMessages(conversationId || null);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<ConversationUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId && user) {
      fetchOtherUser();
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchOtherUser = async () => {
    if (!conversationId || !user) return;

    try {
      // Get other participant
      const { data: participants, error: participantError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .single();

      if (participantError) throw participantError;

      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('user_id', participants.user_id)
        .single();

      if (profileError) throw profileError;

      setOtherUser(profile);
    } catch (error) {
      console.error('Error fetching other user:', error);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    await sendMessage(newMessage);
    setNewMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/messages')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {otherUser && (
            <div 
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => navigate(`/u/${otherUser.username}`)}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={otherUser.avatar_url || undefined} />
                <AvatarFallback>
                  {(otherUser.display_name || otherUser.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold">
                  {otherUser.display_name || otherUser.username}
                </h2>
                <p className="text-sm text-muted-foreground">@{otherUser.username}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}>
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim()}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversation;
