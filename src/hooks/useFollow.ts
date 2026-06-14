import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface UseFollowOptions {
  /** Seed the initial follow state so the UI doesn't flicker while the
   *  network round-trip resolves. Pass the value from a list query
   *  (e.g. search_profiles.is_following). */
  initialIsFollowing?: boolean;
  initialIsRequested?: boolean;
  initialFollowsMe?: boolean;
  /** Skip the initial network refresh entirely. Use when the caller
   *  already has authoritative data and only needs follow/unfollow
   *  mutations + counts on demand. */
  skipInitialRefresh?: boolean;
}

export function useFollow(targetUserId?: string, options: UseFollowOptions = {}) {
  const { initialIsFollowing, initialIsRequested, initialFollowsMe, skipInitialRefresh } = options;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(
    initialIsFollowing ?? null
  );
  const [isRequested, setIsRequested] = useState<boolean>(false);
  const [followsMe, setFollowsMe] = useState<boolean>(initialFollowsMe ?? false);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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
      let theirFollow = null;
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
        const { data: backRow } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", targetUserId)
          .eq("following_id", user.id)
          .maybeSingle();
        theirFollow = backRow;
      }

      setCounts({
        followers: followersCount ?? 0,
        following: followingCount ?? 0,
      });
      setIsFollowing(!!myFollow);
      setIsRequested(!!myRequest && !myFollow);
      setFollowsMe(!!theirFollow);
    } catch (error) {
      console.error("Error refreshing follow data:", error);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (skipInitialRefresh) return;
    refresh();
  }, [refresh, skipInitialRefresh]);

  useEffect(() => {
    setIsFollowing(initialIsFollowing ?? null);
    setIsRequested(initialIsRequested ?? false);
    setFollowsMe(initialFollowsMe ?? false);
  }, [initialIsFollowing, initialIsRequested, initialFollowsMe, targetUserId]);

  useEffect(() => {
    if (!targetUserId) return;
    let currentUserId: string | undefined;

    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUserId = user?.id;
      if (!currentUserId) return;

      const channel = supabase
        .channel(`follow-state-${currentUserId}-${targetUserId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${currentUserId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${currentUserId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_requests', filter: `requester_id=eq.${currentUserId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_requests', filter: `target_id=eq.${currentUserId}` }, refresh)
        .subscribe();

      realtimeChannelRef.current = channel;
    });

    return () => {
      const channel = realtimeChannelRef.current;
      if (channel) {
        supabase.removeChannel(channel);
        realtimeChannelRef.current = null;
      }
    };
  }, [refresh, targetUserId]);

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
        setIsFollowing(false);
      } else if (result === "following") {
        setIsFollowing(true);
        setIsRequested(false);
        setCounts(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-search"] });
      await refresh();
    } catch (error) {
      console.error("Error following:", error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isFollowing, isRequested, refresh, queryClient]);

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
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-search"] });
      await refresh();
    } catch (error) {
      console.error("Error unfollowing:", error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, isFollowing, isRequested, refresh, queryClient]);

  return { isFollowing, isRequested, followsMe, follow, unfollow, loading, counts, refresh };
}
