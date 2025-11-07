import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformPost {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  saves_count: number;
  media_type: string | null;
  media_url: string | null;
  platform: string | null;
  embed_html: string | null;
  thumbnail_url: string | null;
  title: string | null;
  is_public: boolean;
}

export const useUserPlatformPosts = (
  userId: string | undefined,
  platform: string | undefined
) => {
  const [items, setItems] = useState<PlatformPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!userId || !platform) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchPosts();
  }, [userId, platform]);

  const fetchPosts = async (cursor?: string) => {
    if (!userId || !platform) return;

    try {
      const { data, error } = await supabase.rpc("get_user_platform_posts", {
        target_user: userId,
        platform_name: platform,
        limit_count: 20,
        cursor: cursor || null,
      });

      if (error) throw error;

      const posts = (data || []) as PlatformPost[];
      
      if (cursor) {
        setItems((prev) => [...prev, ...posts]);
      } else {
        setItems(posts);
      }

      setHasMore(posts.length === 20);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching platform posts:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (items.length > 0 && hasMore) {
      const lastItem = items[items.length - 1];
      fetchPosts(lastItem.created_at);
    }
  };

  return { items, loading, error, hasMore, loadMore };
};
