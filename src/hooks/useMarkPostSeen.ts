import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BATCH_INTERVAL = 3000; // flush every 3s
const VISIBILITY_THRESHOLD = 0.5; // 50% visible
const MIN_VIEW_TIME = 1500; // 1.5s minimum viewing time

/**
 * Tracks which posts the user has actually viewed in the feed
 * and batch-inserts them into post_seen for feed filtering.
 */
export const useMarkPostSeen = (userId: string | undefined) => {
  const pendingRef = useRef<Set<string>>(new Set());
  const viewTimers = useRef<Map<string, number>>(new Map());
  const flushing = useRef(false);

  // Flush pending seen posts to DB
  const flush = useCallback(async () => {
    if (!userId || pendingRef.current.size === 0 || flushing.current) return;
    flushing.current = true;

    const postIds = Array.from(pendingRef.current);
    pendingRef.current.clear();

    try {
      const rows = postIds.map((post_id) => ({ user_id: userId, post_id }));
      // upsert to handle duplicates gracefully
      await supabase.from('post_seen').upsert(rows, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
    } catch (e) {
      // Re-add failed items back to pending
      postIds.forEach((id) => pendingRef.current.add(id));
    } finally {
      flushing.current = false;
    }
  }, [userId]);

  // Periodic flush
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(flush, BATCH_INTERVAL);
    // Flush on page hide (tab switch, navigate away)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush(); // flush remaining on unmount
    };
  }, [userId, flush]);

  // Returns an IntersectionObserver callback ref for a post element
  const observePost = useCallback(
    (postId: string) => {
      return (el: HTMLDivElement | null) => {
        if (!el || !userId) return;

        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              // Start timer when post becomes visible
              if (!viewTimers.current.has(postId)) {
                viewTimers.current.set(postId, window.setTimeout(() => {
                  pendingRef.current.add(postId);
                  viewTimers.current.delete(postId);
                }, MIN_VIEW_TIME));
              }
            } else {
              // Cancel timer if post scrolls out before min time
              const timer = viewTimers.current.get(postId);
              if (timer) {
                clearTimeout(timer);
                viewTimers.current.delete(postId);
              }
            }
          },
          { threshold: VISIBILITY_THRESHOLD }
        );

        observer.observe(el);

        // Cleanup via MutationObserver isn't needed since React manages the DOM,
        // but we store the observer for potential cleanup
        (el as any).__seenObserver = observer;
      };
    },
    [userId]
  );

  return { observePost };
};
