import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
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
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", userIds);

      // Merge profiles with comments
      const allComments = commentsData.map(comment => ({
        ...comment,
        profiles: profilesData?.find(p => p.user_id === comment.user_id) || null,
        replies: [] as Comment[],
      })) as Comment[];

      // Build tree: separate top-level and replies
      const topLevel: Comment[] = [];
      const replyMap = new Map<string, Comment[]>();

      for (const c of allComments) {
        if (!c.parent_id) {
          topLevel.push(c);
        } else {
          if (!replyMap.has(c.parent_id)) replyMap.set(c.parent_id, []);
          replyMap.get(c.parent_id)!.push(c);
        }
      }

      // Attach replies to parents
      for (const c of topLevel) {
        c.replies = replyMap.get(c.id) || [];
      }

      return topLevel;
    },
  });

  // Total count including replies
  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  const createComment = useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("comments")
        .insert({ 
          post_id: postId, 
          user_id: user.id, 
          content,
          ...(parentId ? { parent_id: parentId } : {}),
        });

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

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Comment deleted" });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to delete comment", 
        variant: "destructive" 
      });
    },
  });

  return {
    comments,
    totalCount,
    isLoading,
    createComment: (content: string, parentId?: string) => createComment.mutate({ content, parentId }),
    isCreating: createComment.isPending,
    deleteComment: deleteComment.mutate,
    isDeleting: deleteComment.isPending,
  };
};
