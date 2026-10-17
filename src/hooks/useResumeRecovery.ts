import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { shouldRecoverQuery } from "@/lib/feedRefreshPolicy";

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
    let backgrounded = document.visibilityState === "hidden";
    let disposed = false;
    let nativeListener: PluginListenerHandle | undefined;
    const recover = async (appEntry = false) => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (!appEntry && now - last < 3000) return;
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
      if (disposed) return;
      if (appEntry) {
        // A foreground refresh needs only the newest page, not every page
        // the person scrolled through before leaving the app.
        await queryClient.cancelQueries({ queryKey: ["following-feed"] });
        queryClient.setQueryData(["following-feed"], (old: any) =>
          old?.pages?.length > 1
            ? { ...old, pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) }
            : old,
        );
      }
      void queryClient.refetchQueries({
        predicate: (q) => shouldRecoverQuery(q.queryKey[0], q.state.status === "error" || q.isStale(), appEntry),
        type: "active",
      });
    };
    const onActiveChange = (active: boolean) => {
      if (!active) {
        backgrounded = true;
        supabase.auth.stopAutoRefresh();
      } else if (backgrounded) {
        backgrounded = false;
        void recover(true);
      }
    };
    const onVis = () => {
      onActiveChange(document.visibilityState === "visible");
    };
    // Focus commonly changes when interacting with embedded players. It may
    // recover other data, but is never proof that the user re-entered the app.
    const onRecoverySignal = () => { void recover(); };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void recover(true);
    };
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/app").then(async ({ App }) => {
        const listener = await App.addListener("appStateChange", ({ isActive }) => onActiveChange(isActive));
        if (disposed) await listener.remove();
        else nativeListener = listener;
      }).catch(() => { /* visibilitychange remains the fallback */ });
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onRecoverySignal);
    window.addEventListener("focus", onRecoverySignal);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      disposed = true;
      void nativeListener?.remove();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onRecoverySignal);
      window.removeEventListener("focus", onRecoverySignal);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [queryClient]);
}
