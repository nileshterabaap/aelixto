import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BATCH_INTERVAL = 3000; // flush every 3s
// Any visibility — the moment a post enters the viewport it counts as seen
// so it never reappears in the feed, regardless of how briefly it scrolled past.
const VISIBILITY_THRESHOLD = 0;

/**
 * Mark a single post as seen immediately (fire-and-forget).
 * Use this when viewing a post on detail/profile/saved pages.
 */
export const markPostSeenImmediate = async (userId: string, postId: string) => {
  try {
    await supabase
      .from('post_seen')
      .upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
  } catch {
    // best-effort
  }
};

/**
 * Mark multiple posts as seen immediately (fire-and-forget).
 */
export const markPostsSeenImmediate = async (userId: string, postIds: string[]) => {
  if (postIds.length === 0) return;
  try {
    const rows = postIds.map((post_id) => ({ user_id: userId, post_id }));
    await supabase
      .from('post_seen')
      .upsert(rows, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
  } catch {
    // best-effort
  }
};

/**
 * Tracks which posts the user has actually viewed in the feed
 * and batch-inserts them into post_seen for feed filtering.
 */
export const useMarkPostSeen = (userId: string | undefined) => {
  const pendingRef = useRef<Set<string>>(new Set());
  const observersRef = useRef<Map<string, IntersectionObserver>>(new Map());
  // Posts currently intersecting the viewport (any visibility), so on
  // refresh we can also count posts the user is looking at right now
  // even if the periodic batch flush hasn't fired yet.
  const visibleRef = useRef<Set<string>>(new Set());
  const flushing = useRef(false);

  const clearPostTracking = useCallback((postId: string) => {
    const observer = observersRef.current.get(postId);
    if (observer) {
      observer.disconnect();
      observersRef.current.delete(postId);
    }

    visibleRef.current.delete(postId);
  }, []);

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

  // Force-flush: include currently-visible posts and await DB write.
  // Used by pull-to-refresh so anything the user actually saw disappears next load.
  const flushNow = useCallback(async () => {
    if (!userId) return;
    visibleRef.current.forEach((id) => pendingRef.current.add(id));
    if (pendingRef.current.size === 0) return;
    // Wait for any in-flight flush to finish
    while (flushing.current) {
      await new Promise((r) => setTimeout(r, 30));
    }
    flushing.current = true;
    const postIds = Array.from(pendingRef.current);
    pendingRef.current.clear();
    try {
      const rows = postIds.map((post_id) => ({ user_id: userId, post_id }));
      await supabase.from('post_seen').upsert(rows, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
    } catch {
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
      observersRef.current.forEach((observer) => observer.disconnect());
      observersRef.current.clear();
      visibleRef.current.clear();
      flush(); // flush remaining on unmount
    };
  }, [userId, flush]);

  const setObservedPostElement = useCallback(
    (postId: string, el: HTMLDivElement | null) => {
      clearPostTracking(postId);

      if (!el || !userId) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            // Mark as seen the moment any part of the post enters the
            // viewport — no dwell timer. Once recorded, stop observing.
            visibleRef.current.add(postId);
            pendingRef.current.add(postId);
            const obs = observersRef.current.get(postId);
            if (obs) {
              obs.disconnect();
              observersRef.current.delete(postId);
            }
          } else {
            visibleRef.current.delete(postId);
          }
        },
        { threshold: [VISIBILITY_THRESHOLD] }
      );

      observersRef.current.set(postId, observer);
      observer.observe(el);
    },
    [clearPostTracking, userId]
  );

  return { setObservedPostElement, flushNow };
};
