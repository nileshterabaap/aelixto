import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mobile browsers/WebViews freeze timers while backgrounded, so the auth
 * token can expire without being refreshed. Requests made after resuming
 * then fail (delete, link fetch, empty profile tabs) until a page reload.
 * On resume/online: restart auto-refresh, renew an expired/near-expiry
 * session, then refetch queries that errored or came back empty-stale.
 */
export function useResumeRecovery(queryClient: QueryClient) {
  useEffect(() => {
    let last = 0;
    const recover = async () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - last < 3000) return;
      last = now;
      try {
        supabase.auth.startAutoRefresh();
        const { data } = await supabase.auth.getSession();
        const exp = data.session?.expires_at ? data.session.expires_at * 1000 : 0;
        if (data.session && exp - Date.now() < 120_000) {
          await supabase.auth.refreshSession();
        }
      } catch {
        /* network may still be waking up; queries retry below */
      }
      queryClient.refetchQueries({
        predicate: (q) => q.state.status === "error" || q.isStale(),
        type: "active",
      });
    };
    const onVis = () => {
      if (document.visibilityState === "visible") recover();
      else supabase.auth.stopAutoRefresh();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    window.addEventListener("pageshow", recover);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
      window.removeEventListener("pageshow", recover);
    };
  }, [queryClient]);
}
