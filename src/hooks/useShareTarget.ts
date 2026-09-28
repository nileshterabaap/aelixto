import { useEffect } from "react";
import { initShareTarget, onSharedLink } from "@/lib/shareTarget";
import { triggerCreatePost } from "@/hooks/useCreatePostTrigger";

/**
 * Opens the create-post composer whenever a link is shared into Aelixto
 * from another app's share sheet.
 */
export const useShareTarget = () => {
  useEffect(() => {
    initShareTarget();
    const off = onSharedLink(() => {
      // Let the composer mount/route settle before triggering it.
      // On a cold start the composer may not be mounted yet, so retry once.
      setTimeout(() => triggerCreatePost(), 60);
      setTimeout(() => triggerCreatePost(), 900);
    });
    return () => {
      off();
    };
  }, []);
};
