import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { INVITE_REF_KEY } from "@/lib/invite";

const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Remembers ?ref=<username> from an invite link and, once the invited person
 * has a brand-new account, follows the inviter automatically (once). */
export function useInviteAutoFollow() {
  const location = useLocation();
  const { user } = useSession();

  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && /^[A-Za-z][A-Za-z0-9_.]{2,29}$/.test(ref)) {
      try { localStorage.setItem(INVITE_REF_KEY, ref); } catch { /* ignore */ }
    }
  }, [location.search]);

  useEffect(() => {
    if (!user?.id) return;
    let ref: string | null = null;
    try { ref = localStorage.getItem(INVITE_REF_KEY); } catch { return; }
    if (!ref) return;
    const created = user.created_at ? new Date(user.created_at).getTime() : 0;
    if (!created || Date.now() - created > NEW_ACCOUNT_WINDOW_MS) {
      localStorage.removeItem(INVITE_REF_KEY);
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id").ilike("username", ref!).maybeSingle();
      if (data?.user_id && data.user_id !== user.id) {
        const { error } = await supabase.rpc("request_or_follow", { _target: data.user_id });
        if (error) return; // retry next launch
      }
      localStorage.removeItem(INVITE_REF_KEY);
    })();
  }, [user?.id, user?.created_at]);
}
