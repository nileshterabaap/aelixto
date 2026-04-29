import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Collection {
  id: string;
  name: string;
  created_at: string;
  preview_thumbnails: string[];
  item_count: number;
}

export const useCollections = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["collections", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Fetch collections
      const { data: cols, error } = await supabase
        .from("collections")
        .select("id, name, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each collection, fetch up to 4 preview thumbnails + count
      const enriched: Collection[] = await Promise.all(
        (cols || []).map(async (col) => {
          const { data: items, count } = await supabase
            .from("collection_items")
            .select("post_id, posts(thumbnail_url, media_url, platform)", { count: "exact" })
            .eq("collection_id", col.id)
            .order("created_at", { ascending: false })
            .limit(4);

          const thumbnails = (items || [])
            .map((item: any) => {
              const p = item.posts;
              if (!p) return null;
              return p.thumbnail_url || p.media_url || null;
            })
            .filter(Boolean) as string[];

          return {
            id: col.id,
            name: col.name,
            created_at: col.created_at,
            preview_thumbnails: thumbnails,
            item_count: count || 0,
          };
        })
      );

      return enriched;
    },
    enabled: !!userId,
  });

  const createCollection = useMutation({
    mutationFn: async (name: string) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("collections")
        .insert({ user_id: userId, name })
        .select("id, name, created_at")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", userId] });
      toast({ title: "Collection created" });
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (collectionId: string) => {
      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", userId] });
      toast({ title: "Collection deleted" });
    },
  });

  const addToCollection = useMutation({
    mutationFn: async ({ collectionId, postId }: { collectionId: string; postId: string }) => {
      const { error } = await supabase
        .from("collection_items")
        .insert({ collection_id: collectionId, post_id: postId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", userId] });
      toast({ title: "Added to collection" });
    },
  });

  const removeFromCollection = useMutation({
    mutationFn: async ({ collectionId, postId }: { collectionId: string; postId: string }) => {
      const { error } = await supabase
        .from("collection_items")
        .delete()
        .eq("collection_id", collectionId)
        .eq("post_id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", userId] });
    },
  });

  return {
    collections,
    isLoading,
    createCollection: createCollection.mutate,
    deleteCollection: deleteCollection.mutate,
    addToCollection: addToCollection.mutate,
    removeFromCollection: removeFromCollection.mutate,
    isCreating: createCollection.isPending,
  };
};

export const useCollectionItems = (collectionId: string | undefined) => {
  return useQuery({
    queryKey: ["collection-items", collectionId],
    queryFn: async () => {
      if (!collectionId) return [];

      const { data, error } = await supabase
        .from("collection_items")
        .select(`
          post_id,
          posts (
            id, user_id, content, created_at, likes_count, saves_count,
            comments_count, reposts_count, media_type, media_url,
            platform, embed_html, thumbnail_url, title, is_public,
            profiles:user_id (username, display_name, avatar_url)
          )
        `)
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || [])
        .filter((item: any) => item.posts)
        .map((item: any) => {
          const post = item.posts;
          const profile = post.profiles;
          return {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            title: post.title || "",
            mediaType: post.media_type,
            mediaUrl: post.media_url,
            platform: post.platform,
            embed_html: post.embed_html,
            thumbnail_url: post.thumbnail_url,
            timestamp: new Date(post.created_at),
            likes: post.likes_count || 0,
            comments: post.comments_count || 0,
            shares: post.reposts_count || 0,
            saves: post.saves_count || 0,
            author: {
              name: profile?.display_name || profile?.username || "Unknown",
              username: profile?.username || "Unknown",
              avatar: profile?.avatar_url || "/placeholder.svg",
            },
            isRealPost: true,
          };
        });
    },
    enabled: !!collectionId,
  });
};
