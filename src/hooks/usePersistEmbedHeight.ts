import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cross-component dedupe so multiple cards for the same post (feed + repost)
// don't double-write.
const lastSentByPost = new Map<string, number>();

/**
 * Returns a `persist(height, aspect?)` callback that lazily writes the
 * measured embed height back to `posts.suggested_height` via RPC.
 *
 * - Ignores tiny changes (<10px) per instance.
 * - Dedupes within 20px across the whole app.
 * - Debounces the actual network call by 1.2s so postMessage bursts during
 *   embed hydration collapse into a single write.
 */
export function usePersistEmbedHeight(postId: string | null | undefined) {
  const lastRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ height: number; aspect: number | null } | null>(null);

  return useCallback(
    (height: number, aspect?: number | null) => {
      if (!postId) return;
      if (!Number.isFinite(height) || height < 120 || height > 3000) return;
      const rounded = Math.round(height);

      if (Math.abs(lastRef.current - rounded) < 10) return;
      lastRef.current = rounded;

      const prior = lastSentByPost.get(postId);
      if (prior && Math.abs(prior - rounded) < 20) return;

      pendingRef.current = { height: rounded, aspect: aspect ?? null };

      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const payload = pendingRef.current;
        if (!payload) return;
        lastSentByPost.set(postId, payload.height);
        void (async () => {
          try {
            await supabase.rpc("update_post_dimensions" as any, {
              _post_id: postId,
              _height: payload.height,
              _aspect: payload.aspect,
            } as any);
          } catch {
            // Silent — if RPC unavailable or rate-limited, just skip.
          }
        })();
      }, 1200);
    },
    [postId]
  );
}