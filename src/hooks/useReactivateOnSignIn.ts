import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * A deactivated account comes back the moment its owner signs in again
 * (password, Google, Apple or account switch). Checked once per account per
 * app launch; the server call is a no-op for active accounts.
 */
const checked = new Set<string>();

async function reactivate(userId: string) {
  if (checked.has(userId)) return;
  checked.add(userId);
  try {
    const { data, error } = await supabase.rpc("reactivate_my_account");
    if (error) {
      checked.delete(userId);
      return;
    }
    if (data === true) {
      toast({ title: "Welcome back!", description: "Your account is active again." });
    }
  } catch {
    checked.delete(userId);
  }
}

export function useReactivateOnSignIn() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      if (id) void reactivate(id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user.id) void reactivate(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);
}
