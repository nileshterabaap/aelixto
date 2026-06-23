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
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
    settings?: {
      hide_likes?: boolean;
    } | null;
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
            avatar_url,
            settings
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
        })
        .select(`
          *,
          profiles!posts_user_id_fkey (
            username,
            display_name,
            avatar_url,
            settings
          )
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (createdPost: any) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      await queryClient.cancelQueries({ queryKey: ["following-feed"] });
      await queryClient.cancelQueries({ queryKey: ["platform-posts"] });
      await queryClient.cancelQueries({ queryKey: ["user-platform-tabs"] });
      await queryClient.cancelQueries({ queryKey: ["user-posts"] });

      queryClient.removeQueries({ queryKey: ["posts"] });
      queryClient.removeQueries({ queryKey: ["platform-posts"] });
      queryClient.removeQueries({ queryKey: ["user-platform-tabs"] });
      queryClient.removeQueries({ queryKey: ["user-posts"] });

      queryClient.setQueryData<any>(["following-feed"], (old: any) => {
        if (!createdPost?.id) return old;

        const feedPost = {
          id: createdPost.id,
          user_id: createdPost.user_id,
          content: createdPost.content,
          created_at: createdPost.created_at,
          likes_count: createdPost.likes_count ?? 0,
          saves_count: createdPost.saves_count ?? 0,
          comments_count: createdPost.comments_count ?? 0,
          reposts_count: createdPost.reposts_count ?? 0,
          media_type: createdPost.media_type,
          media_url: createdPost.media_url,
          platform: createdPost.platform,
          embed_html: createdPost.embed_html,
          thumbnail_url: createdPost.thumbnail_url,
          title: createdPost.title,
          is_public: createdPost.is_public ?? true,
          is_repost: false,
          profiles: {
            username: createdPost.profiles?.username ?? "Anonymous",
            display_name: createdPost.profiles?.display_name ?? null,
            avatar_url: createdPost.profiles?.avatar_url ?? null,
          },
        };

        if (!old?.pages?.length) {
          return { pages: [{ posts: [feedPost], nextCursor: undefined }], pageParams: [undefined] };
        }

        const exists = old.pages.some((page: any) =>
          page.posts?.some((post: any) => post.id === createdPost.id)
        );
        if (exists) return old;

        return {
          ...old,
          pages: [{ ...old.pages[0], posts: [feedPost, ...old.pages[0].posts] }, ...old.pages.slice(1)],
        };
      });

      queryClient.invalidateQueries({ queryKey: ["posts"], refetchType: "all" });
      // The profile grid + tabs are powered by separate caches.
      // Without these the new post only appears after a manual refresh.
      queryClient.invalidateQueries({ queryKey: ["platform-posts"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["user-platform-tabs"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["user-posts"], refetchType: "all" });
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
