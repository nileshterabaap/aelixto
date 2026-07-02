import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface FollowUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface FollowListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  type: "followers" | "following";
}

export function FollowListDialog({ open, onOpenChange, userId, type }: FollowListDialogProps) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!userId || !open) return;
    setLoading(true);

    try {
      if (type === "followers") {
        // People who follow this user
        const { data, error } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", userId);

        if (error) throw error;

        if (data && data.length > 0) {
          const ids = data.map((f) => f.follower_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, display_name, avatar_url")
            .in("user_id", ids);
          setUsers((profiles as FollowUser[]) || []);
        } else {
          setUsers([]);
        }
      } else {
        // People this user follows
        const { data, error } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId);

        if (error) throw error;

        if (data && data.length > 0) {
          const ids = data.map((f) => f.following_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, display_name, avatar_url")
            .in("user_id", ids);
          setUsers((profiles as FollowUser[]) || []);
        } else {
          setUsers([]);
        }
      }
    } catch (error) {
      console.error("Error fetching follow list:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, type, open]);

  useEffect(() => {
    if (open) fetchUsers();
  }, [open, fetchUsers]);

  const handleUserClick = (username: string) => {
    onOpenChange(false);
    navigate(`/u/${username}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto p-0 gap-0 rounded-2xl">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-center text-base font-semibold">
            {type === "followers" ? "Followers" : "Following"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-28 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {type === "followers" ? "No followers yet" : "Not following anyone yet"}
            </div>
          ) : (
            <div className="p-2">
              {users.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => handleUserClick(u.username)}
                  className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-sm font-semibold">
                      {u.display_name?.[0] || u.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.display_name || u.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
