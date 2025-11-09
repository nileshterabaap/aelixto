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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repost", postId, userId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  return {
    isReposted: isReposted || false,
    toggleRepost: repostMutation.mutate,
    isReposting: repostMutation.isPending,
  };
};
