import { supabase } from '@/integrations/supabase/client';
import { preloadAllFeedImages } from '@/lib/preloadImages';
import { useRef, useEffect, useMemo, useCallback, useState } from 'react';

interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  saves_count: number;
  comments_count: number | null;
  reposts_count: number | null;
  media_type: string | null;
  media_url: string | null;
  platform: string | null;
  embed_html: string | null;
  thumbnail_url: string | null;
  title: string | null;
  preview_text?: string | null;
  preview_title?: string | null;
  preview_image_url?: string | null;
  media_kind?: string | null;
  aspect_ratio?: number | null;
  suggested_height?: number | null;
  is_public: boolean;
  feed_cursor?: string | null;
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
  refresh: (seenPostIds?: string[]) => Promise<{ posts: FeedPost[]; nextCursor: string | undefined } | undefined>;
  hasMore: boolean;
}

interface FeedRpcRow extends Omit<FeedPost, 'profiles'> {
  profile_username: string;
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

const PAGE_SIZE = 20;
const mapFeedRows = (data: FeedRpcRow[]): FeedPost[] => data.map((item) => ({
  id: item.id,
  user_id: item.user_id,
  content: item.content,
  created_at: item.created_at,
  likes_count: item.likes_count,
  saves_count: item.saves_count,
  comments_count: item.comments_count,
  reposts_count: item.reposts_count,
  media_type: item.media_type,
  media_url: item.media_url,
  platform: item.platform,
  embed_html: item.embed_html,
  thumbnail_url: item.thumbnail_url,
  title: item.title,
  preview_text: item.preview_text,
  preview_title: item.preview_title,
  preview_image_url: item.preview_image_url,
  media_kind: item.media_kind ?? null,
  aspect_ratio: item.aspect_ratio ?? null,
  suggested_height: item.suggested_height ?? null,
  is_public: item.is_public,
  feed_cursor: item.feed_cursor,
  is_repost: item.is_repost,
  reposted_by_user_id: item.reposted_by_user_id,
  reposted_by_username: item.reposted_by_username,
  profiles: {
    username: item.profile_username,
    display_name: item.profile_display_name,
    avatar_url: item.profile_avatar_url,
  },
}));

const toPage = (data: FeedRpcRow[] | null) => {
  if (!data || data.length === 0) {
    return { posts: [], nextCursor: undefined };
  }

  const mappedPosts = mapFeedRows(data);
  const lastCursor = mappedPosts[mappedPosts.length - 1]?.feed_cursor ?? undefined;
  const nextCursor = mappedPosts.length < PAGE_SIZE ? undefined : lastCursor;

  return { posts: mappedPosts, nextCursor };
};

const fetchFeedPage = async (cursor?: string) => {
  const rpc = supabase.rpc as unknown as (
    fn: 'get_following_feed_v2',
    args: { limit_count: number; cursor_key: string | null }
  ) => Promise<{ data: FeedRpcRow[] | null; error: Error | null }>;

  const { data, error } = await rpc('get_following_feed_v2', {
    limit_count: PAGE_SIZE,
    cursor_key: cursor || null,
  });

  if (error) throw error;

  return toPage(data);
};

const refreshFeedPage = async (seenPostIds: string[]) => {
  const rpc = supabase.rpc as unknown as (
    fn: 'refresh_following_feed_v1',
    args: { limit_count: number; seen_post_ids: string[] }
  ) => Promise<{ data: FeedRpcRow[] | null; error: Error | null }>;

  const { data, error } = await rpc('refresh_following_feed_v1', {
    limit_count: PAGE_SIZE,
    seen_post_ids: seenPostIds,
  });

  if (error) throw error;

  return toPage(data);
};

export const useFollowingFeed = (userId: string | undefined): UseFollowingFeedResult => {
  const preloadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [pages, setPages] = useState<Array<{
    posts: FeedPost[];
    nextCursor: string | undefined;
  }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    preloadedRef.current = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!userId) {
      setPages(null);
      setLoading(false);
      setFetchingMore(false);
      setError(null);
      return;
    }

    setPages(null);
    setLoading(true);
    setFetchingMore(false);
    setError(null);

    void fetchFeedPage(undefined)
      .then((firstPage) => {
        if (requestIdRef.current !== requestId) return;
        setPages([firstPage]);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setPages([]);
        setError(err instanceof Error ? err.message : 'Failed to load feed');
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setLoading(false);
      });
  }, [userId]);

  // Flatten all pages into single array - stable reference
  const items = useMemo(
    () => pages?.flatMap((page) => page.posts) ?? [],
    [pages]
  );

  // Aggressively preload ALL thumbnails once on data arrival
  useEffect(() => {
    if (items.length > 0 && !preloadedRef.current) {
      preloadedRef.current = true;
      // Preload all images immediately for instant scroll
      preloadAllFeedImages(items.map(post => ({
        profiles: { avatar_url: post.profiles?.avatar_url },
        thumbnail_url: post.thumbnail_url,
        media_url: post.media_url,
      })));
    }
  }, [items]);

  // Preload new pages as they arrive
  useEffect(() => {
    if (pages && pages.length > 1) {
      const latestPage = pages[pages.length - 1];
      if (latestPage.posts.length > 0) {
        preloadAllFeedImages(latestPage.posts.map(post => ({
          profiles: { avatar_url: post.profiles?.avatar_url },
          thumbnail_url: post.thumbnail_url,
          media_url: post.media_url,
        })));
      }
    }
  }, [pages]);

  const loadMore = () => {
    const nextCursor = pages?.[pages.length - 1]?.nextCursor;
    if (!userId || !nextCursor || fetchingMore) return;

    setFetchingMore(true);
    void fetchFeedPage(nextCursor)
      .then((nextPage) => {
        setPages((current) => (current ? [...current, nextPage] : [nextPage]));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load more posts');
      })
      .finally(() => setFetchingMore(false));
  };

  const refresh = useCallback(async (seenPostIds: string[] = []) => {
    preloadedRef.current = false;
    if (!userId) return undefined;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setFetchingMore(false);
    setError(null);

    try {
      console.log('[PTR-DEBUG] refresh() calling RPC with seenPostIds count:', seenPostIds.length);
      const firstPage = await refreshFeedPage(seenPostIds);
      console.log('[PTR-DEBUG] refresh() RPC returned posts:', firstPage.posts.length, 'nextCursor:', firstPage.nextCursor);
      if (requestIdRef.current !== requestId) return firstPage;
      setPages([firstPage]);
      console.log('[PTR-DEBUG] refresh() setPages called with', firstPage.posts.length, 'posts');
      return firstPage;
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err instanceof Error ? err.message : 'Failed to refresh feed');
      }
      throw err;
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [userId]);

  const hasReceivedPage = pages !== null;
  const initialFeedPending = Boolean(userId) && !error && items.length === 0 && (!hasReceivedPage || loading);

  return {
    items,
    empty: Boolean(userId) && !initialFeedPending && items.length === 0 && (hasReceivedPage || Boolean(error)),
    loading: initialFeedPending,
    error,
    loadMore,
    refresh,
    hasMore: Boolean(userId) && Boolean(pages?.[pages.length - 1]?.nextCursor),
  };
};

