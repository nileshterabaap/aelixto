import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Copy, Reply, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedPostCard } from "@/components/messages/SharedPostCard";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMessages, Message } from "@/hooks/useMessages";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConversationUser {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MessageMenuState {
  message: Message | null;
  x: number;
  y: number;
}

const EDIT_TIME_LIMIT_MS = 15 * 60 * 1000; // 15 minutes

const Conversation = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { toast } = useToast();
  const { messages, loading, sendMessage } = useMessages(conversationId || null);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<ConversationUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MessageMenuState>({ message: null, x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId && user) {
      fetchOtherUser();
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close menu on outside tap
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menu.message && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu({ message: null, x: 0, y: 0 });
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [menu.message]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchOtherUser = async () => {
    if (!conversationId || !user) return;

    try {
      const { data: participants, error: participantError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .single();

      if (participantError) throw participantError;

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
    setReplyTo(null);
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

  // Long press handlers
  const handleTouchStart = useCallback((msg: Message, e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setMenu({ message: msg, x: touch.clientX, y: touch.clientY });
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((msg: Message, e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ message: msg, x: e.clientX, y: e.clientY });
  }, []);

  // Actions
  const handleCopy = () => {
    if (!menu.message) return;
    navigator.clipboard.writeText(menu.message.content);
    toast({ description: "Copied to clipboard" });
    setMenu({ message: null, x: 0, y: 0 });
  };

  const handleReply = () => {
    if (!menu.message) return;
    setReplyTo(menu.message);
    setMenu({ message: null, x: 0, y: 0 });
  };

  const handleEditStart = () => {
    if (!menu.message) return;
    setEditingId(menu.message.id);
    setEditText(menu.message.content);
    setMenu({ message: null, x: 0, y: 0 });
  };

  const handleEditSave = async () => {
    if (!editingId || !editText.trim()) return;
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: editText.trim() })
        .eq('id', editingId)
        .eq('sender_id', user!.id);
      if (error) throw error;
      // Update local state via re-fetch will happen via realtime, but let's optimistically update
      setEditingId(null);
      setEditText("");
    } catch {
      toast({ title: "Error", description: "Failed to edit message", variant: "destructive" });
    }
  };

  const handleUnsend = async () => {
    if (!menu.message) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', menu.message.id)
        .eq('sender_id', user!.id);
      if (error) throw error;
      toast({ description: "Message unsent" });
    } catch {
      toast({ title: "Error", description: "Failed to unsend message", variant: "destructive" });
    }
    setMenu({ message: null, x: 0, y: 0 });
  };

  const canEdit = (msg: Message) => {
    if (msg.sender_id !== user?.id) return false;
    return Date.now() - new Date(msg.created_at).getTime() < EDIT_TIME_LIMIT_MS;
  };

  const canUnsend = (msg: Message) => msg.sender_id === user?.id;

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
            const postMatch = message.content.match(/\/post\/([a-f0-9-]{36})$/);
            const isPostShare = postMatch && message.content.trim().match(/^https?:\/\/.+\/post\/[a-f0-9-]{36}$/);
            const isEditing = editingId === message.id;

            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                onTouchStart={(e) => handleTouchStart(message, e)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onContextMenu={(e) => handleContextMenu(message, e)}
              >
                {isPostShare && postMatch ? (
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} gap-0.5`}>
                    <SharedPostCard postId={postMatch[1]} isOwn={isOwn} />
                    <p className="text-[10px] px-1 text-muted-foreground">
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                ) : isEditing ? (
                  <div className="max-w-[70%] flex flex-col gap-1">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave();
                        if (e.key === 'Escape') { setEditingId(null); setEditText(""); }
                      }}
                      autoFocus
                      className="text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditingId(null); setEditText(""); }}
                        className="text-[10px] text-muted-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleEditSave}
                        className="text-[10px] text-primary font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-[10px] mt-0.5 ${
                      isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    }`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Context Menu Overlay */}
      {menu.message && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-popover border border-border rounded-xl shadow-lg py-1.5 min-w-[160px] animate-in fade-in zoom-in-95"
          style={{
            left: Math.min(menu.x, window.innerWidth - 180),
            top: Math.min(menu.y - 10, window.innerHeight - 200),
          }}
        >
          <button
            onClick={handleReply}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <Reply className="h-4 w-4" /> Reply
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
          {canEdit(menu.message) && (
            <button
              onClick={handleEditStart}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
          {canUnsend(menu.message) && (
            <button
              onClick={handleUnsend}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Unsend
            </button>
          )}
        </div>
      )}

      {/* Reply banner */}
      {replyTo && (
        <div className="bg-muted/50 border-t border-border px-4 py-2 flex items-center justify-between">
          <div className="text-xs text-muted-foreground truncate flex-1">
            Replying to: <span className="text-foreground">{replyTo.content}</span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-xs text-muted-foreground ml-2">✕</button>
        </div>
      )}

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
