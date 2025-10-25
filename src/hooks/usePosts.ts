import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Post {
  id: string;
  user_id: string;
  title?: string | null;
  content: string;
  media_type: string | null;
  media_url: string | null;
  platform: string | null;
  embed_html?: string | null;
  saves_count: number;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
}

export const usePosts = () => {
  return useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Post[];
    },
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (newPost: {
      title?: string;
      content: string;
      media_type?: string;
      media_url?: string;
      platform?: string;
      embed_html?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          title: newPost.title || null,
          content: newPost.content,
          media_type: newPost.media_type || null,
          media_url: newPost.media_url || null,
          platform: newPost.platform || null,
          embed_html: newPost.embed_html || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({
        title: "Post created!",
        description: "Your post has been published successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create post",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
