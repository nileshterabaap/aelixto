import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UniversalContent {
  url: string;
  platform: string;
  media_type: 'video' | 'image' | 'text' | 'carousel';
  media_url?: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  author_name?: string;
  author_username?: string;
  author_avatar?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  views_count?: number;
  created_at?: string;
  raw_data?: Record<string, unknown>;
}

interface FetchContentParams {
  url: string;
  postId?: string;
  storeResult?: boolean;
}

export const useUniversalContent = (url: string | undefined, postId?: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['universal-content', url],
    queryFn: async (): Promise<UniversalContent | null> => {
      if (!url) return null;

      const { data: result, error: fetchError } = await supabase.functions.invoke(
        'fetch-universal-content',
        {
          body: { url, postId, storeResult: !!postId },
        }
      );

      if (fetchError) throw fetchError;
      if (result?.error) throw new Error(result.error);

      return result as UniversalContent;
    },
    enabled: !!url,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    content: data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
};

export const useFetchUniversalContent = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ url, postId, storeResult }: FetchContentParams) => {
      const { data, error } = await supabase.functions.invoke('fetch-universal-content', {
        body: { url, postId, storeResult },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as UniversalContent;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['universal-content', variables.url], data);
    },
  });

  return {
    fetchContent: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error as Error | null,
  };
};

// Helper to check if a post has raw_json_data cached
export const usePostNativeData = (postId: string | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: ['post-native-data', postId],
    queryFn: async () => {
      if (!postId) return null;

      const { data: post, error } = await supabase
        .from('posts')
        .select('raw_json_data, thumbnail_url, platform, media_url')
        .eq('id', postId)
        .single();

      if (error) throw error;

      return {
        rawData: post?.raw_json_data as unknown as UniversalContent | null,
        thumbnailUrl: post?.thumbnail_url,
        platform: post?.platform,
        mediaUrl: post?.media_url,
      };
    },
    enabled: !!postId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    nativeData: data?.rawData,
    thumbnailUrl: data?.thumbnailUrl,
    platform: data?.platform,
    mediaUrl: data?.mediaUrl,
    isLoading,
  };
};
