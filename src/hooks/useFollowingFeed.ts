import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { preloadFeedImages } from '@/lib/preloadImages';

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
  preview_text?: string | null;
  preview_title?: string | null;
  preview_image_url?: string | null;
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

const fetchFollowingCount = async () => {
  const { data, error } = await supabase.rpc('get_following_count');
  if (error) throw error;
  return data as number;
};

const fetchFeedPage = async (cursor?: string) => {
  const { data, error } = await supabase.rpc('get_following_feed', {
    limit_count: 20,
    cursor: cursor || null,
  });

  if (error) throw error;

  if (!data || data.length === 0) {
    return { posts: [], nextCursor: undefined };
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
    preview_text: item.preview_text ?? null,
    preview_title: item.preview_title ?? null,
    preview_image_url: item.preview_image_url ?? null,
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

  // Preload images for instant display
  preloadFeedImages(mappedPosts);

  const nextCursor = data.length < 20 ? undefined : mappedPosts[mappedPosts.length - 1]?.created_at;

  return { posts: mappedPosts, nextCursor };
};

export const useFollowingFeed = (): UseFollowingFeedResult => {
  const queryClient = useQueryClient();

  // Check following count first
  const { data: followingCount, isLoading: countLoading } = useQuery({
    queryKey: ['following-count'],
    queryFn: fetchFollowingCount,
    // prevent a "blank" first render on navigation by seeding from cache
    initialData: () => queryClient.getQueryData(['following-count']) as number | undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const hasFollowing = (followingCount ?? 0) > 0;

  // Fetch feed with infinite query for pagination
  const {
    data,
    isLoading: feedLoading,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['following-feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: hasFollowing,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  });

  // Flatten all pages into single array
  const items = data?.pages.flatMap((page) => page.posts) ?? [];

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return {
    items,
    empty: !countLoading && !hasFollowing,
    loading: countLoading || (hasFollowing && feedLoading),
    error: feedError?.message ?? null,
    loadMore,
    hasMore: hasNextPage ?? false,
  };
};

