import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export const useComments = (postId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!commentsData) return [];

      // Fetch profiles for all comment authors
      const userIds = commentsData.map(c => c.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", userIds);

      // Merge profiles with comments
      return commentsData.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.user_id === comment.user_id) || null
      })) as Comment[];
    },
  });

  const createComment = useMutation({
    mutationFn: async (content: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("comments")
        .insert({ post_id: postId, user_id: user.id, content });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Comment posted!" });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to post comment", 
        variant: "destructive" 
      });
    },
  });

  return {
    comments,
    isLoading,
    createComment: createComment.mutate,
    isCreating: createComment.isPending,
  };
};
