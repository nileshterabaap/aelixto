import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const usePostActions = (postId: string, userId: string | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
  const handleShare = () => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      navigator.share({ url });
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Post link copied to clipboard" });
    }
  };

  // Delete post
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Post deleted", description: "Your post has been removed" });
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
