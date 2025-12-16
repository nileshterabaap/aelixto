import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  is_repost: boolean;
  original_user_id: string | null;
}

export const useUserPlatformPosts = (
  userId: string | undefined,
  platform: string | undefined
) => {
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ["platform-posts", userId, platform],
    queryFn: async () => {
      if (!userId || !platform) return [];

      const { data, error } = await supabase.rpc("get_user_platform_posts", {
        target_user: userId,
        platform_name: platform,
        limit_count: 50,
        cursor: null,
      });

      if (error) throw error;
      return (data || []) as PlatformPost[];
    },
    enabled: !!userId && !!platform,
  });

  return { items, loading, error: null, hasMore: false, loadMore: () => {} };
};
