import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { INVITE_REF_KEY, INVITE_CHANGED_EVENT, isNewInviteAccount, rememberInvite } from "@/lib/inviteReferral";
import { isValidUsername } from "@/lib/usernameRules";

/** Remembers ?ref=<username> from an invite link and, once the invited person
 * has a brand-new account, follows the inviter automatically (once). */
export function useInviteAutoFollow() {
  const location = useLocation();
  const { user } = useSession();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const changed = () => setRevision(value => value + 1);
    window.addEventListener(INVITE_CHANGED_EVENT, changed);
    window.addEventListener("online", changed);
    return () => {
      window.removeEventListener(INVITE_CHANGED_EVENT, changed);
      window.removeEventListener("online", changed);
    };
  }, []);

  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && isValidUsername(ref)) rememberInvite(ref);
  }, [location.search]);

  useEffect(() => {
    if (!user?.id) return;
    let ref: string | null;
    try { ref = localStorage.getItem(INVITE_REF_KEY); } catch { return; }
    if (!ref) return;
    if (!isNewInviteAccount(user.created_at)) {
      localStorage.removeItem(INVITE_REF_KEY);
      return;
    }
    const inviter = ref;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const apply = async () => {
      try {
      // Equality, not ILIKE: underscores in usernames are literal, not wildcards.
      const { data, error: lookupError } = await supabase.from("profiles").select("user_id").eq("username", inviter).maybeSingle();
      if (disposed) return;
      if (lookupError) throw lookupError;
      if (data?.user_id && data.user_id !== user.id) {
        const { error } = await supabase.rpc("request_or_follow", { _target: data.user_id });
        if (error) throw error;
      }
      if (!disposed && localStorage.getItem(INVITE_REF_KEY) === inviter) localStorage.removeItem(INVITE_REF_KEY);
      } catch {
        if (!disposed && attempt < 4) retry = setTimeout(() => { void apply(); }, 1000 * 2 ** attempt++);
      }
    };
    void apply();
    return () => { disposed = true; if (retry) clearTimeout(retry); };
  }, [user?.id, user?.created_at, revision]);
}
