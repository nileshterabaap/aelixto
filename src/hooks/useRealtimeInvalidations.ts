import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

const invalidatePosts = (queryClient: ReturnType<typeof useQueryClient>, includeFeed = false) => {
  queryClient.invalidateQueries({ queryKey: ["posts"] });
  if (includeFeed) {
    queryClient.invalidateQueries({ queryKey: ["following-feed"] });
  }
  queryClient.invalidateQueries({ queryKey: ["platform-posts"] });
  queryClient.invalidateQueries({ queryKey: ["user-platform-tabs"] });
  queryClient.invalidateQueries({ queryKey: ["user-profile"] });
  queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
};

export const useRealtimeInvalidations = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const invalidateNotifications = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      queryClient.invalidateQueries({ queryKey: ["notification-count", user.id] });
    };

    const invalidateProfile = () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    };

    const invalidateSaved = () => {
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
      queryClient.invalidateQueries({ queryKey: ["collections", user.id] });
      queryClient.invalidateQueries({ queryKey: ["collection-items"] });
    };

    const channel = supabase
      .channel(`app-live-invalidations-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        invalidateProfile,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        invalidateNotifications,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, (payload) => {
        invalidatePosts(queryClient, payload.eventType === "INSERT" || payload.eventType === "DELETE");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, () => invalidatePosts(queryClient))
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => invalidatePosts(queryClient))
      .on("postgres_changes", { event: "*", schema: "public", table: "reposts" }, (payload) => {
        invalidatePosts(queryClient, payload.eventType === "INSERT" || payload.eventType === "DELETE");
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saves", filter: `user_id=eq.${user.id}` },
        () => {
          invalidatePosts(queryClient);
          invalidateSaved();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collections", filter: `user_id=eq.${user.id}` },
        invalidateSaved,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "collection_items" }, invalidateSaved)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);
};