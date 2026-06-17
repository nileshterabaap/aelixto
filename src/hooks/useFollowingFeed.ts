import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
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
  hasMore: boolean;
  reachedEnd: boolean;
  refresh: () => Promise<void>;
}

interface FeedRpcRow extends Omit<FeedPost, 'profiles'> {
  profile_username: string;
  profile_display_name: string | null;
  profile_avatar_url: string | null;
}

interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | undefined;
}

const PAGE_SIZE = 20;
const REFRESH_SCAN_DELAYS_MS = [0, 450, 900, 1400];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchFeedPage = async (cursor?: string): Promise<FeedPage> => {
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

  // Only end pagination when the server returns zero rows. Returning fewer
  // than PAGE_SIZE can still mean more unseen posts exist beyond this cursor
  // band, so keep paging until the backend confirms an empty page.
  const lastCursor = mappedPosts[mappedPosts.length - 1]?.feed_cursor ?? undefined;
  const nextCursor = mappedPosts.length === 0 ? undefined : lastCursor;

  return { posts: mappedPosts, nextCursor };
};

export const useFollowingFeed = (userId: string | undefined): UseFollowingFeedResult => {
  const preloadedRef = useRef(false);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['following-feed', userId] as const, [userId]);

  // Fetch feed directly — no count gate, single RPC call
  const {
    data,
    isLoading: feedLoading,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes - then background refetch
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // refetch if stale on mount/page reload
    refetchOnReconnect: true,
    structuralSharing: true,
    placeholderData: (previousData) => previousData,
  });

  // Flatten all pages into single array - stable reference
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data?.pages]
  );

  const reachedEnd = useMemo(
    () => data?.pages.some((page) => page.posts.length === 0) ?? false,
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
    if (!userId) return;

    preloadedRef.current = false;
    await queryClient.cancelQueries({ queryKey, exact: true });

    const previousData = queryClient.getQueryData<InfiniteData<FeedPage>>(queryKey);
    const knownPostIds = new Set(
      previousData?.pages.flatMap((page) => page.posts.map((post) => post.id)) ?? []
    );

    // Pull-to-refresh should behave like a real scan, not a cache flip: keep
    // the current feed visible while we poll the fresh first page briefly.
    // This catches posts that were just created/expanded and avoids replacing
    // the feed with an empty result before the backend has settled.
    let firstPage: FeedPage = { posts: [], nextCursor: undefined };
    for (let attempt = 0; attempt < REFRESH_SCAN_DELAYS_MS.length; attempt += 1) {
      const delay = REFRESH_SCAN_DELAYS_MS[attempt];
      if (delay > 0) await wait(delay);

      firstPage = await fetchFeedPage(undefined);
      const hasNewTopPost = firstPage.posts.some((post) => !knownPostIds.has(post.id));
      const isLastAttempt = attempt === REFRESH_SCAN_DELAYS_MS.length - 1;

      if (hasNewTopPost || isLastAttempt) break;
    }

    queryClient.setQueryData(queryKey, {
      pages: [firstPage],
      pageParams: [undefined],
    });

    // Clean up inactive epoch-based feed caches left by the previous refresh
    // strategy so they cannot be restored later by navigation.
    queryClient.removeQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === 'following-feed' &&
        query.queryKey[1] === userId &&
        query.queryKey.length > 2,
    });
  }, [queryClient, queryKey, userId]);

  return {
    items,
    empty: Boolean(userId) && !feedLoading && items.length === 0,
    loading: Boolean(userId) && feedLoading,
    error: feedError?.message ?? null,
    loadMore,
    hasMore: Boolean(userId) && (hasNextPage ?? false),
    reachedEnd: Boolean(userId) && reachedEnd,
    refresh,
  };
};

