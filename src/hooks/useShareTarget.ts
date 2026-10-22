import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hasPendingSharedLink, initShareTarget, onSharedLink } from "@/lib/shareTarget";
import { triggerCreatePost } from "@/hooks/useCreatePostTrigger";

/** Titles the create-post composer shows on its two steps. */
const COMPOSER_TITLES = new Set(["Create post", "Add details"]);

/** Finds the create-post composer if it is currently open on screen. */
const findOpenComposer = (): HTMLElement | null => {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  for (const dialog of Array.from(dialogs)) {
    const title = dialog.querySelector("h2")?.textContent?.trim() ?? "";
    if (COMPOSER_TITLES.has(title)) return dialog;
  }
  return null;
};

const isAuthRoute = (pathname: string) => pathname === "/auth" || pathname.startsWith("/auth/");

/**
 * Opens the create-post composer whenever a link is shared into Aelixto
 * from another app's share sheet.
 *
 * - Signed out (or on the sign-in page): the link waits, the user is told
 *   to sign in, and the composer opens with it right after sign-in. Links
 *   expire after a few minutes so they never pop up unexpectedly later.
 * - Composer already open: it is closed and reopened so the new link is
 *   filled in immediately instead of waiting for the next open.
 */
export const useShareTarget = () => {
  const { pathname } = useLocation();
  const [shareTick, setShareTick] = useState(0);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const toastShownForTick = useRef(0);

  useEffect(() => {
    initShareTarget();
    const off = onSharedLink(() => setShareTick((t) => t + 1));
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (shareTick === 0 || signedIn === null || !hasPendingSharedLink()) return;

    if (!signedIn || isAuthRoute(pathname)) {
      if (!signedIn && toastShownForTick.current !== shareTick) {
        toastShownForTick.current = shareTick;
        toast("Sign in to post the link you shared.");
      }
      return;
    }

    const open = () => {
      if (hasPendingSharedLink()) triggerCreatePost();
    };
    const timers: number[] = [];
    const composer = findOpenComposer();
    if (composer) {
      // Close the current composer, then reopen it once its exit animation
      // finishes — reopening is what makes it pick up the new link.
      composer.querySelector<HTMLElement>('[aria-label="Close"]')?.click();
      timers.push(window.setTimeout(open, 450), window.setTimeout(open, 1300));
    } else {
      // Let the composer mount/route settle; on a cold start it may not be
      // mounted yet, so retry once.
      timers.push(window.setTimeout(open, 60), window.setTimeout(open, 900));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [shareTick, signedIn, pathname]);
};
