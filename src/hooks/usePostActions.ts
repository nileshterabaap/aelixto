import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDailyPostLimit } from "@/hooks/useDailyPostLimit";

export const usePostActions = (postId: string, userId: string | undefined) => {
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

  // Toggle like with optimistic update
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");

      if (isLiked) {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
      } else {
        await supabase.from("likes").insert({ post_id: postId, user_id: userId });
      }
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["like", postId, userId] });
      
      // Snapshot previous value
      const previousLike = queryClient.getQueryData(["like", postId, userId]);
      
      // Optimistically update
      queryClient.setQueryData(["like", postId, userId], !isLiked);
      
      return { previousLike };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousLike !== undefined) {
        queryClient.setQueryData(["like", postId, userId], context.previousLike);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["like", postId, userId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

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
    const url = `${window.location.origin}/post/${postId}`;
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

      // Fetch created_at first so we can decide whether to refund the daily credit
      const { data: existing } = await supabase
        .from("posts")
        .select("created_at")
        .eq("id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", userId);

      if (error) throw error;

      return { createdAt: existing?.created_at as string | undefined };
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

      toast({
        title: "Post deleted",
        description: refunded
          ? "Your post has been removed. Daily credit refunded."
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

  return {
    isLiked: isLiked || false,
    isSaved: isSaved || false,
    toggleLike: likeMutation.mutate,
    toggleSave: saveMutation.mutate,
    handleShare,
    deletePost: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
};
