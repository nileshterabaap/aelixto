import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { preloadFeedImages, preloadProfileImages } from "./preloadImages";

// Centralized prefetch functions for instant navigation

export const prefetchSession = async (queryClient: QueryClient) => {
  // Only prefetch if not already in cache
  if (queryClient.getQueryData(['session'])) return;
  
  await queryClient.prefetchQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return { session, user: session?.user ?? null };
    },
    staleTime: Infinity,
  });
};

export const prefetchFollowingFeed = async (queryClient: QueryClient) => {
  // Only prefetch if not already in cache
  if (queryClient.getQueryData(['following-feed'])) return;
  
  const session = queryClient.getQueryData(['session']) as { user: { id: string } | null } | undefined;
  if (!session?.user) return;

  // Prefetch following count first
  await queryClient.prefetchQuery({
    queryKey: ['my-following-count', session.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_following_count');
      if (error) throw error;
      return data ?? 0;
    },
    staleTime: 60 * 1000,
  });

  // Then prefetch first page of feed using the same seen-aware RPC as useFollowingFeed.
  await queryClient.prefetchInfiniteQuery({
    queryKey: ['following-feed'],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_following_feed_v3', {
        limit_count: 20,
        cursor_key: pageParam ?? null,
      } as any);
      if (error) throw error;
      
      // Map to the same format useFollowingFeed expects
      const mappedPosts = (data || []).map((item: any) => ({
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
        is_public: item.is_public,
        media_kind: item.media_kind,
        aspect_ratio: item.aspect_ratio,
        suggested_height: item.suggested_height,
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
      
      return {
        posts: mappedPosts,
        nextCursor: mappedPosts.length === 20 ? data?.[data.length - 1]?.feed_cursor : undefined,
      };
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
      // Match useFollowingFeed's own staleTime so warm returns to "/" render
      // the cached feed instantly instead of triggering a refetch skeleton.
      staleTime: 30 * 1000,
  });
};

export const prefetchProfile = async (queryClient: QueryClient) => {
  const session = queryClient.getQueryData(['session']) as { user: { id: string; email?: string; user_metadata?: Record<string, any> } | null } | undefined;
  if (!session?.user) return;
  if (queryClient.getQueryData(['profile', session.user.id])) return;

  await queryClient.prefetchQuery({
    queryKey: ['profile', session.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user!.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      
      // Preload profile images
      preloadProfileImages(data);
      
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const prefetchDiscover = async (queryClient: QueryClient) => {
  if (queryClient.getQueryData(['posts'])) return;

  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, profiles:user_id(username, avatar_url, display_name)`)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// Map routes to their prefetch functions
const routePrefetchers: Record<string, (qc: QueryClient) => Promise<void>> = {
  '/': prefetchFollowingFeed,
  '/discover': prefetchDiscover,
  '/profile': prefetchProfile,
};

export const prefetchRoute = async (path: string, queryClient: QueryClient) => {
  const prefetcher = routePrefetchers[path];
  if (prefetcher) {
    await prefetcher(queryClient);
  }
};

// Prefetch all core data on app init
export const prefetchCoreData = async (queryClient: QueryClient) => {
  await prefetchSession(queryClient);
  
  // Run these in parallel for speed
  await Promise.all([
    prefetchFollowingFeed(queryClient),
    prefetchProfile(queryClient),
  ]);
};
