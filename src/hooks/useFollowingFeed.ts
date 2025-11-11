import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FeedPost {
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
  is_repost?: boolean;
  reposted_by_user_id?: string | null;
  reposted_by_username?: string | null;
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface UseFollowingFeedResult {
  items: FeedPost[];
  empty: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
}

export const useFollowingFeed = (): UseFollowingFeedResult => {
  const [items, setItems] = useState<FeedPost[]>([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const checkFollowingCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_following_count');
      
      if (error) throw error;
      
      if (data === 0) {
        setEmpty(true);
        setLoading(false);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error checking following count:', err);
      setError(err instanceof Error ? err.message : 'Failed to check following count');
      setLoading(false);
      return false;
    }
  }, []);

  const fetchFeed = useCallback(async (cursor?: string) => {
    try {
      const { data, error } = await supabase.rpc('get_following_feed', {
        limit_count: 20,
        cursor: cursor || null,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        setHasMore(false);
        return [];
      }

      if (data.length < 20) {
        setHasMore(false);
      }

      // Map RPC response to FeedPost format
      const mappedPosts: FeedPost[] = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        content: item.content,
        created_at: item.created_at,
        likes_count: item.likes_count,
        saves_count: item.saves_count,
        media_type: item.media_type,
        media_url: item.media_url,
        platform: item.platform,
        embed_html: item.embed_html,
        thumbnail_url: item.thumbnail_url,
        title: item.title,
        is_public: item.is_public,
        is_repost: item.is_repost,
        reposted_by_user_id: item.reposted_by_user_id,
        reposted_by_username: item.reposted_by_username,
        profiles: {
          username: item.profile_username,
          display_name: item.profile_display_name,
          avatar_url: item.profile_avatar_url,
        },
      }));

      return mappedPosts;
    } catch (err) {
      console.error('Error fetching following feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feed');
      return [];
    }
  }, []);

  const loadInitialFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    const hasFollowing = await checkFollowingCount();
    
    if (!hasFollowing) {
      return;
    }

    const posts = await fetchFeed();
    setItems(posts);
    setLoading(false);
  }, [checkFollowingCount, fetchFeed]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || items.length === 0) return;

    setIsLoadingMore(true);
    const lastItem = items[items.length - 1];
    const cursor = lastItem.created_at;

    const newPosts = await fetchFeed(cursor);
    setItems(prev => [...prev, ...newPosts]);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, items, fetchFeed]);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  return {
    items,
    empty,
    loading,
    error,
    loadMore,
    hasMore,
  };
};
