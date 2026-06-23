import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { preloadAllFeedImages } from '@/lib/preloadImages';
import { useRef, useEffect, useMemo, useCallback } from 'react';

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
  refresh: () => Promise<unknown>;
  hasMore: boolean;
  reachedEnd: boolean;
}

interface FeedRpcRow extends Omit<FeedPost, 'profiles'> {
  profile_username: string;
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

const PAGE_SIZE = 20;
const fetchFeedPage = async (cursor?: string) => {
  const rpc = supabase.rpc as unknown as (
    fn: 'get_following_feed',
    args: { limit_count: number; cursor: string | null }
  ) => Promise<{ data: FeedRpcRow[] | null; error: Error | null }>;

  const { data, error } = await rpc('get_following_feed', {
    limit_count: PAGE_SIZE,
    cursor: cursor || null,
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return { posts: [], nextCursor: undefined };
  }

  // Map RPC response to FeedPost format
  const mappedPosts: FeedPost[] = data.map((item) => ({
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
    is_repost: item.is_repost,
    reposted_by_user_id: item.reposted_by_user_id,
    reposted_by_username: item.reposted_by_username,
    profiles: {
      username: item.profile_username,
      display_name: item.profile_display_name,
      avatar_url: item.profile_avatar_url,
    },
  }));

  // Cursor = created_at of last row. End when fewer than PAGE_SIZE returned.
  const nextCursor =
    mappedPosts.length < PAGE_SIZE
      ? undefined
      : mappedPosts[mappedPosts.length - 1]?.created_at;

  return { posts: mappedPosts, nextCursor };
};

export const useFollowingFeed = (userId: string | undefined): UseFollowingFeedResult => {
  const preloadedRef = useRef(false);
  const queryClient = useQueryClient();

  // Fetch feed directly — no count gate, single RPC call
  const {
    data,
    isLoading: feedLoading,
    isFetching,
    error: feedError,
    fetchNextPage,
    refetch,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['following-feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes - then background refetch
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always', // refresh on mount/page reload so an empty first paint cannot stick
    refetchOnReconnect: true,
    retry: 2,
    structuralSharing: true,
  });

  // Flatten all pages into single array - stable reference
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data?.pages]
  );

  const reachedEnd = useMemo(
    () =>
      data?.pages.some((page) => page.posts.length === 0) ||
      (data !== undefined && (hasNextPage === false)),
    [data, hasNextPage]
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
    const pages = data?.pages;
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
  }, [data?.pages]);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const refresh = useCallback(async () => {
    preloadedRef.current = false;
    await queryClient.cancelQueries({ queryKey: ['following-feed'] });
    return await refetch();
  }, [queryClient, refetch]);

  const hasReceivedPage = data !== undefined;
  const initialFeedPending = Boolean(userId) && !feedError && items.length === 0 && (!hasReceivedPage || feedLoading || isFetching);

  return {
    items,
    empty: Boolean(userId) && hasReceivedPage && !initialFeedPending && items.length === 0,
    loading: initialFeedPending,
    error: feedError?.message ?? null,
    loadMore,
    refresh,
    hasMore: Boolean(userId) && (hasNextPage ?? false),
    reachedEnd: Boolean(userId) && Boolean(reachedEnd),
  };
};

