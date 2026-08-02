import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UsernameLink } from "@/components/UsernameLink";

interface LikesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

interface Liker {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export const LikesSheet = ({ open, onOpenChange, postId }: LikesSheetProps) => {
  const { data: likers = [], isLoading } = useQuery({
    queryKey: ["post-likes", postId],
    enabled: open && !!postId,
    queryFn: async (): Promise<Liker[]> => {
      const { data: likes, error } = await supabase
        .from("likes")
        .select("user_id, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = [...new Set((likes || []).map((l) => l.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", ids);
      const map = new Map((profiles || []).map((p) => [p.user_id, p]));
      return ids
        .map((id) => map.get(id))
        .filter(Boolean) as Liker[];
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[100] p-0 rounded-t-2xl h-[60dvh] flex flex-col gap-0 border-t"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <SheetTitle className="text-center">Likes</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
          ) : likers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No likes yet</p>
          ) : (
            <div className="space-y-3">
              {likers.map((u) => (
                <div key={u.user_id} className="flex items-center gap-3">
                  <img
                    src={u.avatar_url || "/placeholder.svg"}
                    alt={u.username}
                    className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <UsernameLink username={u.username} className="font-semibold text-sm block truncate">
                      @{u.username}
                    </UsernameLink>
                    {u.display_name && (
                      <span className="text-xs text-muted-foreground truncate block">{u.display_name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
