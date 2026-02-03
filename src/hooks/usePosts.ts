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
  thumbnail_url?: string | null;
  preview_image_url?: string | null;
  preview_title?: string | null;
  preview_text?: string | null;
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
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch if cached data exists
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
      media_url?: string | null;
      platform?: string;
      embed_html?: string;
      thumbnail_url?: string;
      preview_text?: string; // Caption/description from embed metadata
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
          thumbnail_url: newPost.thumbnail_url || null,
          preview_text: newPost.preview_text || null, // Store embed caption
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
