import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAuthorProfiles } from "@/lib/authorProfile";
import { useToast } from "@/hooks/use-toast";
import type { PostDraft } from "@/hooks/useDrafts";

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
      // (saved posts first, then drafts kept in the collection).
      const enriched: Collection[] = await Promise.all(
        (cols || []).map(async (col) => {
          const [{ data: items, count }, { data: draftItems, count: draftCount }] = await Promise.all([
            supabase
              .from("collection_items")
              .select("post_id, posts(thumbnail_url, media_url, platform)", { count: "exact" })
              .eq("collection_id", col.id)
              .order("created_at", { ascending: false })
              .limit(4),
            supabase
              .from("collection_drafts")
              .select("draft_id, post_drafts(thumbnail_url)", { count: "exact" })
              .eq("collection_id", col.id)
              .order("created_at", { ascending: false })
              .limit(4),
          ]);

          const postThumbs = (items || []).map((item: any) => {
            const p = item.posts;
            if (!p) return null;
            return p.thumbnail_url || p.media_url || null;
          });
          const draftThumbs = (draftItems || []).map(
            (item: any) => item.post_drafts?.thumbnail_url || null,
          );
          const thumbnails = [...postThumbs, ...draftThumbs].filter(Boolean) as string[];

          return {
            id: col.id,
            name: col.name,
            created_at: col.created_at,
            preview_thumbnails: thumbnails,
            item_count: (count || 0) + (draftCount || 0),
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

  const addDraftToCollection = useMutation({
    mutationFn: async ({ collectionId, draftId }: { collectionId: string; draftId: string }) => {
      const { error } = await supabase
        .from("collection_drafts")
        .insert({ collection_id: collectionId, draft_id: draftId });
      // Already in this collection counts as success.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: (_data, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ["collections", userId] });
      queryClient.invalidateQueries({ queryKey: ["collection-drafts", collectionId] });
      toast({ title: "Draft added to collection" });
    },
    onError: () => {
      toast({ title: "Couldn't add draft", description: "Please try again.", variant: "destructive" });
    },
  });

  const removeDraftFromCollection = useMutation({
    mutationFn: async ({ collectionId, draftId }: { collectionId: string; draftId: string }) => {
      const { error } = await supabase
        .from("collection_drafts")
        .delete()
        .eq("collection_id", collectionId)
        .eq("draft_id", draftId);
      if (error) throw error;
    },
    onSuccess: (_data, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ["collections", userId] });
      queryClient.invalidateQueries({ queryKey: ["collection-drafts", collectionId] });
    },
  });

  return {
    collections,
    isLoading,
    createCollection: createCollection.mutate,
    deleteCollection: deleteCollection.mutate,
    addToCollection: addToCollection.mutate,
    removeFromCollection: removeFromCollection.mutate,
    addDraftToCollection: addDraftToCollection.mutate,
    removeDraftFromCollection: removeDraftFromCollection.mutate,
    isCreating: createCollection.isPending,
  };
};

/** Drafts the owner has placed in a collection (newest first). */
export const useCollectionDrafts = (collectionId: string | undefined) => {
  return useQuery({
    queryKey: ["collection-drafts", collectionId],
    queryFn: async () => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from("collection_drafts")
        .select("draft_id, created_at, post_drafts(*)")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || [])
        .map((row: any) => row.post_drafts)
        .filter(Boolean) as PostDraft[];
    },
    enabled: !!collectionId,
    retry: 2,
    staleTime: 0,
  });
};

export const useCollectionItems = (collectionId: string | undefined) => {
  return useQuery({
    queryKey: ["collection-items", collectionId],
    queryFn: async () => {
      if (!collectionId) return [];

      // Step 1: item ids (avoids a deep nested join that can fail in some webviews)
      const { data: items, error: itemsError } = await supabase
        .from("collection_items")
        .select("post_id, created_at")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;

      const postIds = (items || []).map((i: any) => i.post_id).filter(Boolean);
      if (!postIds.length) return [];

      // Step 2: posts
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(
          "id, user_id, content, created_at, likes_count, saves_count, comments_count, reposts_count, media_type, media_url, platform, embed_html, thumbnail_url, title, preview_text, preview_title, preview_image_url, is_public"
        )
        .in("id", postIds);

      if (postsError) throw postsError;

      // Step 3: authors (throws after retries, so the query retries instead
      // of caching nameless posts)
      const authorIds = Array.from(new Set((posts || []).map((p: any) => p.user_id)));
      const profileMap = await fetchAuthorProfiles(authorIds);
      const postMap = new Map((posts || []).map((p: any) => [p.id, p]));

      return postIds
        .map((id: string) => postMap.get(id))
        .filter(Boolean)
        .map((post: any) => {
          const profile = profileMap.get(post.user_id);
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
            preview_text: post.preview_text,
            preview_title: post.preview_title,
            preview_image_url: post.preview_image_url,
            timestamp: new Date(post.created_at),
            likes: post.likes_count || 0,
            comments: post.comments_count || 0,
            shares: post.reposts_count || 0,
            saves: post.saves_count || 0,
            author: {
              name: profile?.display_name || profile?.username || "Unknown",
              username: profile?.username || "Unknown",
              avatar: profile?.avatar_url || "",
            },
            isRealPost: true,
          };
        });
    },
    enabled: !!collectionId,
    retry: 2,
    staleTime: 0,
  });
};

