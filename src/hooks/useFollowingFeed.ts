import { useInfiniteQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { preloadAllFeedImages } from '@/lib/preloadImages';
import { useRef, useEffect, useMemo } from 'react';

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
  is_public: boolean;
  feed_cursor?: string | null;
  is_repost?: boolean;
  reposted_by_user_id?: string | null;
  reposted_by_username?: string | null;
  reposted_at?: string | null;
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
  refresh: () => Promise<number>;
}

interface FeedRpcRow extends Omit<FeedPost, 'profiles'> {
  profile_username: string;
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

const PAGE_SIZE = 20;

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
    is_public: item.is_public,
    feed_cursor: item.feed_cursor,
    is_repost: item.is_repost,
    reposted_by_user_id: item.reposted_by_user_id,
    reposted_by_username: item.reposted_by_username,
    reposted_at: item.reposted_at,
    profiles: {
      username: item.profile_username,
      display_name: item.profile_display_name,
      avatar_url: item.profile_avatar_url,
    },
  }));

  const nextCursor = data.length < PAGE_SIZE ? undefined : mappedPosts[mappedPosts.length - 1]?.feed_cursor ?? undefined;

  return { posts: mappedPosts, nextCursor };
};

export const useFollowingFeed = (userId?: string): UseFollowingFeedResult => {
  const preloadedRef = useRef(false);
  const queryClient = useQueryClient();
  const feedQueryKey = useMemo(() => ['following-feed', userId] as const, [userId]);

  // Fetch feed directly — no count gate, single RPC call
  const {
    data,
    isLoading: feedLoading,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: feedQueryKey,
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes - then background refetch
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    structuralSharing: true,
  });

  // Flatten all pages into single array - stable reference
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data?.pages]
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
    if (data?.pages && data.pages.length > 1) {
      const latestPage = data.pages[data.pages.length - 1];
      if (latestPage.posts.length > 0) {
        preloadAllFeedImages(latestPage.posts.map(post => ({
          profiles: { avatar_url: post.profiles?.avatar_url },
          thumbnail_url: post.thumbnail_url,
          media_url: post.media_url,
        })));
      }
    }
  }, [data?.pages?.length]);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Pull-to-refresh must behave like reopening Home: throw away old cursor
  // pages and fetch page 1 with cursor=null so seen-filtered posts can rotate out.
  const refresh = async (): Promise<number> => {
    if (!userId) return 0;
    const firstPage = await fetchFeedPage(undefined);
    queryClient.setQueryData(feedQueryKey, {
      pages: [firstPage],
      pageParams: [undefined],
    });
    return firstPage.posts.length;
  };

  return {
    items,
    empty: !feedLoading && items.length === 0,
    loading: feedLoading,
    error: feedError?.message ?? null,
    loadMore,
    hasMore: hasNextPage ?? false,
    refresh,
  };
};

