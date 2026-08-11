import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDailyPostLimit } from "@/hooks/useDailyPostLimit";

interface UsePostActionsOptions {
  isRepost?: boolean;
  onDeleted?: () => void;
}

export const usePostActions = (
  postId: string,
  userId: string | undefined,
  options: UsePostActionsOptions = {}
) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { decrement: decrementDailyCount } = useDailyPostLimit();

  // Check if post is liked
  const { data: isLiked } = useQuery({
    queryKey: ["like", postId, userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
  });

  // Check if post is saved
  const { data: isSaved } = useQuery({
    queryKey: ["save", postId, userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("saves")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
  });

  // Ref-driven liked state so rapid taps never read a stale render value.
  const likedRef = useRef<boolean>(!!isLiked);
  useEffect(() => {
    likedRef.current = !!isLiked;
  }, [isLiked]);

  // Toggle like with optimistic update
  const likeMutation = useMutation({
    mutationFn: async (nextLiked: boolean) => {
      if (!userId) throw new Error("Not authenticated");

      if (!nextLiked) {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("likes")
          .upsert(
            { post_id: postId, user_id: userId },
            { onConflict: "user_id,post_id", ignoreDuplicates: true }
          );
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["like", postId, userId] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["like", postId, userId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  // Returns the new liked state so callers can drive their own optimistic
  // count/animation without depending on the (possibly stale) isLiked render value.
  const toggleLike = useCallback((): boolean => {
    const next = !likedRef.current;
    likedRef.current = next;
    queryClient.setQueryData(["like", postId, userId], next);
    likeMutation.mutate(next);
    return next;
  }, [likeMutation, queryClient, postId, userId]);

  // Toggle save with optimistic update
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");

      if (isSaved) {
        await supabase
          .from("saves")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        toast({ title: "Post removed from saved" });
      } else {
        await supabase.from("saves").insert({ post_id: postId, user_id: userId });
        toast({ title: "Post saved!", description: "Added to your saved collection" });
      }
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["save", postId, userId] });
      
      // Snapshot previous value
      const previousSave = queryClient.getQueryData(["save", postId, userId]);
      
      // Optimistically update
      queryClient.setQueryData(["save", postId, userId], !isSaved);
      
      return { previousSave };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSave !== undefined) {
        queryClient.setQueryData(["save", postId, userId], context.previousSave);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["save", postId, userId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
    },
  });

  // Share functionality
  const handleShare = async () => {
    const { buildShortUrl, buildPostPath } = await import("@/lib/shortUrl");
    const url = await buildShortUrl(buildPostPath(postId));
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // User cancelled or permission denied — fallback to clipboard
        navigator.clipboard.writeText(url);
        toast({ title: "Link copied!", description: "Post link copied to clipboard" });
      }
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Post link copied to clipboard" });
    }
  };

  // Delete post
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");

      if (options.isRepost) {
        const { data, error } = await supabase
          .from("reposts")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId)
          .select("id");

        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Repost not found or not owned");

        return { createdAt: undefined as string | undefined, deletedRepost: true };
      }

      // Atomic delete + (in-cycle only) Aelix Score deduction, server-side.
      const { data, error } = await supabase.rpc("delete_post_with_score", {
        p_post_id: postId,
      });
      if (error) throw error;
      const res = (data ?? {}) as {
        created_at?: string;
        deducted?: number;
      };
      return {
        createdAt: res.created_at,
        deletedRepost: false,
        deducted: res.deducted ?? 0,
      };
    },
    onSuccess: (result) => {
      // Refund the daily post credit only if the post was created today (same local day)
      let refunded = false;
      try {
        if (result?.createdAt) {
          const createdLocal = new Date(result.createdAt).toLocaleDateString();
          const todayLocal = new Date().toLocaleDateString();
          if (createdLocal === todayLocal) {
            decrementDailyCount();
            refunded = true;
          }
        }
      } catch { /* ignore */ }

      // Invalidate every cache that may contain this post so the UI updates immediately
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["following-feed"] });
      queryClient.invalidateQueries({ queryKey: ["platform-posts"] });
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      if (result?.deducted) {
        queryClient.invalidateQueries({ queryKey: ["current-profile"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }

      options.onDeleted?.();

      toast({
        title: result?.deletedRepost ? "Repost removed" : "Post deleted",
        description: result?.deletedRepost
          ? "Removed from your profile."
          : refunded
          ? "You got your slot back."
          : "Your post has been removed.",
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to delete post", 
        variant: "destructive" 
      });
    },
  });

  // Toggle pin (max 5 per platform, enforced in DB trigger)
  const pinMutation = useMutation({
    mutationFn: async ({ pinned, platform }: { pinned: boolean; platform?: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("posts")
        .update({ pinned_at: pinned ? new Date().toISOString() : null })
        .eq("id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      return { pinned, platform };
    },
    onSuccess: ({ pinned }) => {
      queryClient.invalidateQueries({ queryKey: ["platform-posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: pinned ? "Pinned to profile" : "Unpinned" });
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (msg.includes("PIN_LIMIT_REACHED")) {
        toast({
          title: "Pin limit reached",
          description: "You can pin up to 5 posts per platform. Unpin one first.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Failed to update pin", variant: "destructive" });
      }
    },
  });

  const hideCountsMutation = useMutation({
    mutationFn: async (hide: boolean) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("posts")
        .update({ hide_counts: hide })
        .eq("id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      return hide;
    },
    onSuccess: (hide) => {
      queryClient.invalidateQueries({ queryKey: ["platform-posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: hide ? "Interaction counts hidden" : "Interaction counts visible" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const commentsDisabledMutation = useMutation({
    mutationFn: async (disabled: boolean) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("posts")
        .update({ comments_disabled: disabled })
        .eq("id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      return disabled;
    },
    onSuccess: (disabled) => {
      queryClient.invalidateQueries({ queryKey: ["platform-posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: disabled ? "Commenting turned off" : "Commenting turned on" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const editCaptionMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("posts")
        .update({ content })
        .eq("id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      return content;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Caption updated" });
    },
    onError: () => toast({ title: "Failed to update caption", variant: "destructive" }),
  });

  return {
    isLiked: isLiked || false,
    isSaved: isSaved || false,
    toggleLike,
    toggleSave: saveMutation.mutate,
    handleShare,
    deletePost: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    togglePin: pinMutation.mutate,
    isPinning: pinMutation.isPending,
    toggleHideCounts: hideCountsMutation.mutate,
    toggleCommentsDisabled: commentsDisabledMutation.mutate,
    editCaption: editCaptionMutation.mutate,
    isEditingCaption: editCaptionMutation.isPending,
  };
};
