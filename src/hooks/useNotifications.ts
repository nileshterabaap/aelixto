import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useEffect } from "react";

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'repost' | 'follow';
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  post?: {
    title: string | null;
    thumbnail_url: string | null;
  };
}

export const useNotificationCount = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: count = 0, isLoading } = useQuery({
    queryKey: ["notification-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
      
      if (error) {
        console.error("Error fetching notification count:", error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          // Invalidate the count query when notifications change
          queryClient.invalidateQueries({ queryKey: ["notification-count", user.id] });
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return { count, isLoading };
};

export const useNotifications = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Fetch notifications
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }
      
      if (!data || data.length === 0) return [];
      
      // Get unique actor IDs
      const actorIds = [...new Set(data.map(n => n.actor_id))];
      
      // Get unique post IDs (filter out nulls)
      const postIds = [...new Set(data.map(n => n.post_id).filter(Boolean))];
      
      // Fetch actor profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", actorIds);
      
      // Fetch posts
      const { data: posts } = postIds.length > 0 
        ? await supabase
            .from("posts")
            .select("id, title, thumbnail_url")
            .in("id", postIds)
        : { data: [] };
      
      // Map profiles and posts to notifications
      const profileMap = new Map<string, typeof profiles extends (infer T)[] ? T : never>();
      profiles?.forEach(p => profileMap.set(p.user_id, p));
      
      const postMap = new Map<string, { id: string; title: string | null; thumbnail_url: string | null }>();
      posts?.forEach(p => postMap.set(p.id, p));
      
      return data.map(notification => ({
        ...notification,
        actor: profileMap.get(notification.actor_id),
        post: notification.post_id ? postMap.get(notification.post_id) : undefined,
      })) as Notification[];
    },
    enabled: !!user?.id,
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notification-count", user?.id] });
    },
  });

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("recipient_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notification-count", user?.id] });
    },
  });

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  return {
    notifications,
    isLoading,
    markAllRead: markAllReadMutation.mutate,
    markAsRead: markAsReadMutation.mutate,
    isMarkingAllRead: markAllReadMutation.isPending,
    refetch,
  };
};
