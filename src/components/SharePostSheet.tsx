import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link2, Search, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/use-toast";

interface SharePostSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

interface ShareableUser {
  conversationId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export const SharePostSheet = ({ open, onOpenChange, postId }: SharePostSheetProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const [recentChats, setRecentChats] = useState<ShareableUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ userId: string; username: string; displayName: string | null; avatarUrl: string | null }>>([]);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Fetch recent conversations when sheet opens
  useEffect(() => {
    if (!open || !user) return;
    setSent({});
    setSearchQuery("");
    setSearchResults([]);
    fetchRecentChats();
  }, [open, user]);

  const fetchRecentChats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: participantData } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!participantData?.length) {
        setRecentChats([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map((p) => p.conversation_id);

      // Get conversations ordered by most recent
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, updated_at")
        .in("id", conversationIds)
        .order("updated_at", { ascending: false })
        .limit(20);

      // Get other participants
      const { data: otherParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds)
        .neq("user_id", user.id);

      const otherUserIds = otherParticipants?.map((p) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", otherUserIds);

      const chats: ShareableUser[] = (conversations || [])
        .map((conv) => {
          const participant = otherParticipants?.find((p) => p.conversation_id === conv.id);
          const profile = profiles?.find((p) => p.user_id === participant?.user_id);
          if (!profile) return null;
          return {
            conversationId: conv.id,
            userId: profile.user_id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
          };
        })
        .filter(Boolean) as ShareableUser[];

      setRecentChats(chats);
    } catch (err) {
      console.error("Error fetching recent chats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Search users
  useEffect(() => {
    if (!searchQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc("search_profiles", {
          q: searchQuery.trim(),
          limit_count: 10,
        });
        setSearchResults(
          (data || [])
            .filter((p: any) => p.user_id !== user.id)
            .map((p: any) => ({
              userId: p.user_id,
              username: p.username,
              displayName: p.display_name,
              avatarUrl: p.avatar_url,
            }))
        );
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  const sendPostToUser = useCallback(
    async (targetUserId: string) => {
      if (!user || sending[targetUserId] || sent[targetUserId]) return;

      setSending((prev) => ({ ...prev, [targetUserId]: true }));

      try {
        // Find or create conversation
        const { data: myParticipants } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);

        let conversationId: string | null = null;

        if (myParticipants?.length) {
          const convIds = myParticipants.map((p) => p.conversation_id);
          const { data: otherParticipant } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("user_id", targetUserId)
            .in("conversation_id", convIds)
            .limit(1)
            .maybeSingle();

          if (otherParticipant) {
            conversationId = otherParticipant.conversation_id;
          }
        }

        if (!conversationId) {
          const { data: newConv, error: convError } = await supabase
            .from("conversations")
            .insert({})
            .select()
            .single();
          if (convError) throw convError;

          const { error: partError } = await supabase
            .from("conversation_participants")
            .insert([
              { conversation_id: newConv.id, user_id: user.id },
              { conversation_id: newConv.id, user_id: targetUserId },
            ]);
          if (partError) throw partError;
          conversationId = newConv.id;
        }

        // Send the post as a message with a special format
        const postUrl = `${window.location.origin}/post/${postId}`;
        const { error: msgError } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: postUrl,
        });
        if (msgError) throw msgError;

        setSent((prev) => ({ ...prev, [targetUserId]: true }));
      } catch (err) {
        console.error("Error sending post:", err);
        toast({ title: "Failed to send", variant: "destructive" });
      } finally {
        setSending((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [user, postId, sending, sent, toast]
  );

  const handleCopyLink = () => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!" });
  };

  const displayList = searchQuery.trim() ? searchResults : recentChats;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-8 max-h-[70vh]">
        <SheetHeader className="px-5 pb-3">
          <SheetTitle className="text-center text-base font-semibold">Share</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl bg-muted/50 border-none h-10"
            />
          </div>
        </div>

        {/* Copy link row */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-3 px-5 py-3 w-full hover:bg-muted/50 active:bg-muted transition-colors"
        >
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Link2 className="h-5 w-5 text-foreground" />
          </div>
          <span className="font-medium text-sm">Copy link</span>
        </button>

        {/* User list */}
        <div className="overflow-y-auto max-h-[40vh] px-0">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && displayList.length === 0 && !searchQuery.trim() && (
            <p className="text-center text-sm text-muted-foreground py-8">No recent chats</p>
          )}

          {!loading && displayList.length === 0 && searchQuery.trim() && (
            <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
          )}

          {displayList.map((item) => {
            const uid = "conversationId" in item ? (item as ShareableUser).userId : item.userId;
            const username = item.username;
            const displayName = item.displayName;
            const avatarUrl = item.avatarUrl;
            const isSent = sent[uid];
            const isSending = sending[uid];

            return (
              <div
                key={uid}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-muted text-sm">
                    {username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {displayName || username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">@{username}</p>
                </div>
                <Button
                  size="sm"
                  variant={isSent ? "outline" : "default"}
                  className={`rounded-full px-5 h-8 text-xs font-semibold ${
                    isSent ? "border-muted-foreground/30" : ""
                  }`}
                  disabled={isSending || isSent}
                  onClick={() => sendPostToUser(uid)}
                >
                  {isSending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isSent ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Sent
                    </span>
                  ) : (
                    "Send"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
