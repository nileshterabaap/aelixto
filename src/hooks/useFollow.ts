import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseFollowOptions {
  /** Seed the initial follow state so the UI doesn't flicker while the
   *  network round-trip resolves. Pass the value from a list query
   *  (e.g. search_profiles.is_following). */
  initialIsFollowing?: boolean;
  /** Skip the initial network refresh entirely. Use when the caller
   *  already has authoritative data and only needs follow/unfollow
   *  mutations + counts on demand. */
  skipInitialRefresh?: boolean;
}

export function useFollow(targetUserId?: string, options: UseFollowOptions = {}) {
  const { initialIsFollowing, skipInitialRefresh } = options;
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(
    initialIsFollowing ?? null
  );
  const [isRequested, setIsRequested] = useState<boolean>(false);
  const [counts, setCounts] = useState<{ followers: number; following: number }>({ 
    followers: 0, 
    following: 0 
  });

  const refresh = useCallback(async () => {
    if (!targetUserId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get follower count (people following this user)
      const { count: followersCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetUserId);

      // Get following count (people this user follows)
      const { count: followingCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", targetUserId);

      // Check if current user follows this profile
      let myFollow = null;
      let myRequest = null;
      if (user) {
        const { data } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
          .maybeSingle();
        myFollow = data;
        const { data: reqRow } = await supabase
          .from("follow_requests")
          .select("id")
          .eq("requester_id", user.id)
          .eq("target_id", targetUserId)
          .maybeSingle();
        myRequest = reqRow;
      }

      setCounts({
        followers: followersCount ?? 0,
        following: followingCount ?? 0,
      });
      setIsFollowing(!!myFollow);
      setIsRequested(!!myRequest && !myFollow);
    } catch (error) {
      console.error("Error refreshing follow data:", error);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (skipInitialRefresh) return;
    refresh();
  }, [refresh, skipInitialRefresh]);

  const follow = useCallback(async () => {
    if (!targetUserId || isFollowing || isRequested) return;
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("request_or_follow", { _target: targetUserId });
      if (error) throw error;
      const result = (data as string) || "";
      if (result === "requested") {
        setIsRequested(true);
      } else if (result === "following") {
        setIsFollowing(true);
        setCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
      await refresh();
    } catch (error) {
      console.error("Error following:", error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isFollowing, isRequested, refresh]);

  const unfollow = useCallback(async () => {
    if (!targetUserId || (!isFollowing && !isRequested)) return;
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const wasFollowing = isFollowing;
      setIsFollowing(false);
      setIsRequested(false);
      if (wasFollowing) {
        setCounts(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      }

      const { error } = await supabase.rpc("cancel_follow_or_request", { _target: targetUserId });
      if (error) throw error;
      await refresh();
    } catch (error) {
      console.error("Error unfollowing:", error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isFollowing, isRequested, refresh]);

  return { isFollowing, isRequested, follow, unfollow, loading, counts, refresh };
}
