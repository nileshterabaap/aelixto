import { UserPlus } from "lucide-react";
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
