import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Copy, Reply, Pencil, Trash2, Check, CheckCheck, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedPostCard } from "@/components/messages/SharedPostCard";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMessages, Message } from "@/hooks/useMessages";
import { useSession } from "@/hooks/useSession";
import { useImageUpload } from "@/hooks/useImageUpload";
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
const IMAGE_PREFIX = "🖼️__IMAGE__:";
const VIDEO_PREFIX = "🎞️__VIDEO__:";

export const parseImageContent = (body: string): string | null => {
  const trimmed = body.trim();
  return trimmed.startsWith(IMAGE_PREFIX)
    ? trimmed.slice(IMAGE_PREFIX.length).trim()
    : null;
};

export const parseVideoContent = (body: string): string | null => {
  const trimmed = body.trim();
  return trimmed.startsWith(VIDEO_PREFIX)
    ? trimmed.slice(VIDEO_PREFIX.length).trim()
    : null;
};

const parseMediaContent = (
  body: string
): { url: string; kind: "image" | "video" } | null => {
  const img = parseImageContent(body);
  if (img) return { url: img, kind: "image" };
  const vid = parseVideoContent(body);
  if (vid) return { url: vid, kind: "video" };
  return null;
};

const Conversation = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { toast } = useToast();
  const { messages, loading, sendMessage, otherStatus } = useMessages(conversationId || null);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<ConversationUser | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLElement>(null);
  const didInitialScroll = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, uploading } = useImageUpload();
  const [menu, setMenu] = useState<MessageMenuState>({ message: null, x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Swipe-to-reply state
  const swipeRef = useRef<{
    id: string;
    x: number;
    y: number;
    dir: 1 | -1; // 1 = swipe right (other's msg), -1 = swipe left (own msg)
    active: boolean;
    cancelled: boolean;
  } | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  const SWIPE_TRIGGER = 55;
  const SWIPE_MAX = 90;

  useEffect(() => {
    if (conversationId && user) {
      fetchOtherUser();
    }
  }, [conversationId, user]);

  useEffect(() => {
    if (!didInitialScroll.current) {
      if (messages.length === 0) return;
      // Land at the bottom instantly on open (no visible scroll animation).
      didInitialScroll.current = true;
      const jump = () => {
        const el = scrollAreaRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        messagesEndRef.current?.scrollIntoView({ block: "end" });
      };
      jump();
      requestAnimationFrame(jump);
      window.setTimeout(jump, 60);
      return;
    }
    scrollToBottom();
  }, [messages]);

  // Reset the instant-jump flag when switching chats
  useEffect(() => {
    didInitialScroll.current = false;
  }, [conversationId]);

  // When user triggers reply (via swipe or menu), scroll to bottom so the
  // reply banner + input remain visible above the keyboard.
  useEffect(() => {
    if (replyTo) {
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [replyTo]);

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

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const isVideo = file.type.startsWith("video/");
    const url = await uploadImage(file, "posts", user.id, {
      silent: true,
      allowVideo: true,
    });
    if (!url) return;
    const activeReply = replyTo;
    setReplyTo(null);
    const content = `${isVideo ? VIDEO_PREFIX : IMAGE_PREFIX}${url}`;
    await sendMessage(
      activeReply ? `↪️__REPLY__:${activeReply.id}\n${content}` : content
    );
  };

  const handleSend = async () => {
    const body = newMessage.trim();
    if (!body || sendingRef.current) return;

    sendingRef.current = true;
    setIsSending(true);

    const activeReply = replyTo;
    setNewMessage("");
    setReplyTo(null);

    const content = activeReply ? `↪️__REPLY__:${activeReply.id}\n${body}` : body;

    await sendMessage(content);

    sendingRef.current = false;
    setIsSending(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDaySeparator = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const isSameDay = (a: string, b: string) => {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  };

  const parseReply = (content: string): { replyToId: string | null; body: string } => {
    const m = content.match(/^↪️__REPLY__:([a-f0-9-]{36})\n([\s\S]*)$/);
    if (m) return { replyToId: m[1], body: m[2] };
    return { replyToId: null, body: content };
  };

  const scrollToMessage = useCallback((id: string) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1400);
  }, []);

  const getDisplayName = (id: string | undefined) => {
    if (!id) return '';
    if (id === user?.id) return 'yourself';
    return otherUser?.display_name || otherUser?.username || '';
  };

  const isPostShareContent = (body: string) => {
    const trimmed = body.trim();
    return /^https?:\/\/.+\/post\/[a-f0-9-]{36}$/.test(trimmed);
  };
  const extractPostId = (body: string) => {
    const m = body.trim().match(/\/post\/([a-f0-9-]{36})$/);
    return m ? m[1] : null;
  };

  // Long press handlers
  const handleTouchStart = useCallback((msg: Message, e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeRef.current = {
      id: msg.id,
      x: touch.clientX,
      y: touch.clientY,
      dir: msg.sender_id === user?.id ? -1 : 1,
      active: false,
      cancelled: false,
    };
    longPressTimer.current = setTimeout(() => {
      setMenu({ message: msg, x: touch.clientX, y: touch.clientY });
    }, 500);
  }, [user?.id]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const s = swipeRef.current;
    if (!s || s.cancelled) return;
    const touch = e.touches[0];
    const dx = touch.clientX - s.x;
    const dy = touch.clientY - s.y;
    const rawDx = s.dir === 1 ? Math.max(0, dx) : Math.min(0, dx);

    if (!s.active) {
      // Cancel if vertical scroll dominates
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(rawDx)) {
        s.cancelled = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        setSwipe(null);
        return;
      }
      if (Math.abs(rawDx) > 8) {
        s.active = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      } else {
        return;
      }
    }

    // Rubber-band beyond max
    let display = rawDx;
    if (Math.abs(rawDx) > SWIPE_MAX) {
      const overflow = Math.abs(rawDx) - SWIPE_MAX;
      display = (SWIPE_MAX + overflow * 0.25) * Math.sign(rawDx);
    }
    setSwipe({ id: s.id, dx: display });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const s = swipeRef.current;
    if (s?.active && swipe && swipe.id === s.id && Math.abs(swipe.dx) >= SWIPE_TRIGGER) {
      const msg = messages.find(m => m.id === s.id);
      if (msg) setReplyTo(msg);
    }
    swipeRef.current = null;
    setSwipe(null);
  }, [swipe, messages]);

  const handleContextMenu = useCallback((msg: Message, e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ message: msg, x: e.clientX, y: e.clientY });
  }, []);

  // Actions
  const handleCopy = () => {
    if (!menu.message) return;
    navigator.clipboard.writeText(parseReply(menu.message.content).body);
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
    setEditText(parseReply(menu.message.content).body);
    setMenu({ message: null, x: 0, y: 0 });
  };

  const handleEditSave = async () => {
    if (!editingId || !editText.trim()) return;
    const original = messages.find(m => m.id === editingId);
    const prefix = original ? (parseReply(original.content).replyToId
      ? `↪️__REPLY__:${parseReply(original.content).replyToId}\n`
      : '') : '';
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: prefix + editText.trim() })
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

  // Compute WhatsApp-style tick state for one of my messages
  const getTickState = (msg: Message): 'sent' | 'delivered' | 'seen' => {
    if (!otherStatus) return 'sent';
    const created = new Date(msg.created_at).getTime();
    const read = otherStatus.last_read_at ? new Date(otherStatus.last_read_at).getTime() : 0;
    const delivered = otherStatus.last_delivered_at ? new Date(otherStatus.last_delivered_at).getTime() : 0;
    if (read >= created) return 'seen';
    if (delivered >= created) return 'delivered';
    return 'sent';
  };

  if (loading) {
    return (
      <div className="screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div
      data-kbdebug="chat-root"
      className="bg-background flex flex-col overflow-hidden"
      style={{ height: 'calc(100dvh - var(--kb))' }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border pt-safe">
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
      <main data-kbdebug="list" ref={scrollAreaRef} className="flex-1 overflow-y-auto flex flex-col">
        <div className="container max-w-2xl mx-auto w-full px-4 py-4 space-y-1 animate-fade-in mt-auto">
          {messages.map((message, idx) => {
            const isOwn = message.sender_id === user?.id;
            const { replyToId, body } = parseReply(message.content);
            const repliedMessage = replyToId ? messages.find(m => m.id === replyToId) : null;
            const repliedBody = repliedMessage ? parseReply(repliedMessage.content).body : null;
            const postMatch = body.match(/\/post\/([a-f0-9-]{36})$/);
            const isPostShare = postMatch && body.trim().match(/^https?:\/\/.+\/post\/[a-f0-9-]{36}$/);
            const isEditing = editingId === message.id;
            const prev = idx > 0 ? messages[idx - 1] : null;
            const senderChanged = !prev || prev.sender_id !== message.sender_id;
            const showDaySeparator = !prev || !isSameDay(prev.created_at, message.created_at);

            return (
              <div key={message.id}>
                {showDaySeparator && (
                  <div className="flex justify-center py-3">
                    <span className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-3 py-1">
                      {formatDaySeparator(message.created_at)}
                    </span>
                  </div>
                )}
                <div
                  ref={(el) => { messageRefs.current[message.id] = el; }}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                    senderChanged && !showDaySeparator ? 'mt-2' : ''
                  } relative transition-colors duration-500 rounded-lg ${
                    highlightId === message.id ? 'bg-primary/10' : ''
                  }`}
                  onTouchStart={(e) => handleTouchStart(message, e)}
                  onTouchMove={(e) => handleTouchMove(e)}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onContextMenu={(e) => handleContextMenu(message, e)}
                >
                  {/* Reply icon revealed during swipe */}
                  {swipe?.id === message.id && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-colors ${
                        isOwn ? 'right-2' : 'left-2'
                      }`}
                      style={{
                        width: 32,
                        height: 32,
                        opacity: Math.min(1, Math.abs(swipe.dx) / SWIPE_TRIGGER),
                        background:
                          Math.abs(swipe.dx) >= SWIPE_TRIGGER
                            ? 'hsl(var(--primary) / 0.15)'
                            : 'hsl(var(--muted))',
                      }}
                    >
                      <Reply
                        className="h-4 w-4"
                        style={{
                          color:
                            Math.abs(swipe.dx) >= SWIPE_TRIGGER
                              ? 'hsl(var(--primary))'
                              : 'hsl(var(--muted-foreground))',
                        }}
                      />
                    </div>
                  )}
                  <div
                    className="w-full flex"
                    style={{
                      justifyContent: isOwn ? 'flex-end' : 'flex-start',
                      transform:
                        swipe?.id === message.id
                          ? `translate3d(${swipe.dx}px, 0, 0)`
                          : undefined,
                      transition: swipe?.id === message.id ? 'none' : 'transform 180ms ease',
                      touchAction: 'pan-y',
                    }}
                  >
                {isPostShare && postMatch ? (
                  <SharedPostCard postId={postMatch[1]} isOwn={isOwn} />
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
                  <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    {replyToId && repliedMessage && (() => {
                      const repliedIsPost = isPostShareContent(repliedBody || '');
                      const repliedPostId = repliedIsPost ? extractPostId(repliedBody || '') : null;
                      const authorLabel = message.sender_id === repliedMessage.sender_id
                        ? (isOwn ? 'You replied to yourself' : `${getDisplayName(message.sender_id)} replied to themselves`)
                        : (isOwn ? `You replied to ${getDisplayName(repliedMessage.sender_id)}` : 'Replied to you');
                      return (
                        <>
                          <span className={`text-[11px] text-muted-foreground mb-1 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                            {authorLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => scrollToMessage(repliedMessage.id)}
                            className={`max-w-full flex ${isOwn ? 'justify-end' : 'justify-start'} focus:outline-none`}
                            style={{ marginBottom: -10 }}
                          >
                            {repliedIsPost && repliedPostId ? (
                              <div className="opacity-60 pointer-events-none scale-90 origin-bottom">
                                <SharedPostCard postId={repliedPostId} isOwn={isOwn} />
                              </div>
                            ) : (
                              <div
                                className={`rounded-2xl px-3 py-1.5 text-sm opacity-60 max-w-full ${
                                  isOwn ? 'bg-primary/40 text-primary-foreground' : 'bg-muted text-foreground'
                                }`}
                                style={{ paddingBottom: 14 }}
                              >
                                <span className="line-clamp-2 break-words">
                                  {parseImageContent(repliedBody || '')
                                    ? 'Photo'
                                    : parseVideoContent(repliedBody || '')
                                      ? 'Video'
                                      : repliedBody}
                                </span>
                              </div>
                            )}
                          </button>
                        </>
                      );
                    })()}
                    {(() => { const media = parseMediaContent(body); return (
                    <div
                      className={`rounded-lg ${media ? 'p-1' : 'px-3 py-1.5'} ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      } ${replyToId && repliedMessage ? 'relative z-10' : ''}`}
                    >
                      {media?.kind === 'image' && (
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <img
                            src={media.url}
                            alt="Shared photo"
                            loading="lazy"
                            onLoad={() => scrollToBottom()}
                            className="rounded-md max-h-[320px] w-auto max-w-full object-cover"
                          />
                        </a>
                      )}
                      {media?.kind === 'video' && (
                        <video
                          src={media.url}
                          controls
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={() => scrollToBottom()}
                          className="rounded-md max-h-[320px] w-auto max-w-full"
                        />
                      )}
                      <p className={`text-sm whitespace-pre-wrap break-words ${media ? 'px-2 pb-0.5' : ''}`}>
                        {media ? '' : body}
                        <span
                          className={`float-right ml-2 text-[10px] leading-none select-none relative top-[6px] ${
                            isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          {formatTime(message.created_at)}
                          {isOwn && (() => {
                            const state = getTickState(message);
                            if (state === 'seen') {
                              // 2 solid ticks — full opacity (reads as "black/dark" on own bubble)
                              return <CheckCheck className="inline-block ml-1 h-3 w-3 align-[-2px] text-primary-foreground" />;
                            }
                            if (state === 'delivered') {
                              return <CheckCheck className="inline-block ml-1 h-3 w-3 align-[-2px] text-primary-foreground/50" />;
                            }
                            return <Check className="inline-block ml-1 h-3 w-3 align-[-2px] text-primary-foreground/50" />;
                          })()}
                        </span>
                      </p>
                    </div>
                    ); })()}
                  </div>
                )}
                  </div>
                </div>
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
            Replying to:{' '}
            <span className="text-foreground">
              {parseImageContent(parseReply(replyTo.content).body)
                ? 'Photo'
                : parseVideoContent(parseReply(replyTo.content).body)
                  ? 'Video'
                  : parseReply(replyTo.content).body}
            </span>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-xs text-muted-foreground ml-2">✕</button>
        </div>
      )}

      {/* Input */}
      <div data-kbdebug="composer" className="sticky bottom-0 bg-background border-t border-border pb-safe">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <form
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleImagePick}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Send a photo or video"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </Button>
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1"
              // type="search" + autocomplete off suppresses Chrome Android's
              // key/location/card autofill toolbar above the keyboard.
              type="search"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              name={`msg-${conversationId ?? "new"}`}
              inputMode="text"
              data-form-type="other"
              data-lpignore="true"
              aria-autocomplete="none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || isSending}
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Conversation;
