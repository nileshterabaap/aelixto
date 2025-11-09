import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useRepost = (postId: string, userId: string | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: isReposted } = useQuery({
    queryKey: ["repost", postId, userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("reposts")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!userId,
  });

  const repostMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");

      if (isReposted) {
        await supabase
          .from("reposts")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        toast({ title: "Repost removed" });
      } else {
        await supabase.from("reposts").insert({ post_id: postId, user_id: userId });
        toast({ title: "Reposted!", description: "Added to your profile" });
      }
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["repost", postId, userId] });
      
      // Snapshot previous value
      const previousRepost = queryClient.getQueryData(["repost", postId, userId]);
      
      // Optimistically update
      queryClient.setQueryData(["repost", postId, userId], !isReposted);
      
      return { previousRepost };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousRepost !== undefined) {
        queryClient.setQueryData(["repost", postId, userId], context.previousRepost);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repost", postId, userId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["platform-posts"] });
    },
  });

  return {
    isReposted: isReposted || false,
    toggleRepost: repostMutation.mutate,
    isReposting: repostMutation.isPending,
  };
};
