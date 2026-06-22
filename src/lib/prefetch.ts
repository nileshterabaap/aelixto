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
  const session = queryClient.getQueryData(['session']) as { user: { id: string } | null } | undefined;
  if (!session?.user) return;

  // Only prefetch if not already in cache for this specific signed-in user
  if (queryClient.getQueryData(['following-feed', session.user.id])) return;

  // Prefetch following count first
  await queryClient.prefetchQuery({
    queryKey: ['following-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_following_count');
      if (error) throw error;
      return data ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // The home feed is seen-filtered and must be loaded by useFollowingFeed,
  // otherwise app-start prefetch can race ahead of the signed-in feed state.
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
