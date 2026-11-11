import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { shareInvite } from "@/lib/invite";

export function useMyUsername() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my-username", user?.id],
    enabled: !!user?.id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username").eq("user_id", user!.id).maybeSingle();
      return data?.username ?? null;
    },
  }).data;
}

export function InviteButton({ className = "" }: { className?: string }) {
  const username = useMyUsername();
  return (
    <button
      type="button"
      onClick={() => shareInvite(username)}
      className={`w-full max-w-xs flex items-center justify-center gap-3 rounded-full bg-foreground text-background py-3 text-lg font-semibold active:scale-[0.98] transition-transform ${className}`}
    >
      <UserPlus className="h-6 w-6" /> Let's Invite
    </button>
  );
}

/** New accounts (first 7 days) see the invite under "You're all caught up"
 *  only the first time; afterwards it never shows there again. */
const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;
export function CaughtUpInvite({ className = "" }: { className?: string }) {
  const { user } = useSession();
  const [show] = useState(() => {
    if (!user?.id || !user.created_at) return false;
    const key = `caught-up-invite-shown:${user.id}`;
    try {
      if (localStorage.getItem(key)) return false;
      if (Date.now() - new Date(user.created_at).getTime() > NEW_ACCOUNT_MS) return false;
      localStorage.setItem(key, "1");
      return true;
    } catch { return false; }
  });
  return show ? <InviteButton className={className} /> : null;
}
