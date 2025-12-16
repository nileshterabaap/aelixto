import { useEffect } from "react";
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

const THUMB_BACKFILL_PLATFORMS = new Set(["instagram", "facebook"]);
const inflightBackfills = new Set<string>();

async function backfillThumbnail(post: PlatformPost) {
  if (!post.media_url || !post.platform) return;
  const platform = post.platform.toLowerCase();
  if (!THUMB_BACKFILL_PLATFORMS.has(platform)) return;
  if (post.thumbnail_url) return;

  const key = `${post.id}:${platform}`;
  if (inflightBackfills.has(key)) return;
  inflightBackfills.add(key);

  try {
    await supabase.functions.invoke("fetch-post-preview", {
      body: {
        postId: post.id,
        url: post.media_url,
        platform,
      },
    });
  } catch {
    // silent: this is a best-effort background improvement
  } finally {
    inflightBackfills.delete(key);
  }
}

export const useUserPlatformPosts = (userId: string | undefined, platform: string | undefined) => {
  const queryClient = useQueryClient();

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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Background thumbnail backfill for Instagram/Facebook posts missing thumbnails.
  useEffect(() => {
    if (!items.length) return;

    const platformLower = (platform || "").toLowerCase();
    if (!THUMB_BACKFILL_PLATFORMS.has(platformLower)) return;

    const missing = items.filter((p) => !p.thumbnail_url && !!p.media_url);
    if (!missing.length) return;

    let cancelled = false;

    (async () => {
      // small, safe concurrency (1-by-1) to avoid rate limits
      for (const p of missing.slice(0, 6)) {
        if (cancelled) return;
        await backfillThumbnail(p);
      }

      if (cancelled) return;
      // Refresh the grid data once backfills likely completed
      queryClient.invalidateQueries({ queryKey: ["platform-posts", userId, platform] });
    })();

    return () => {
      cancelled = true;
    };
  }, [items, platform, queryClient, userId]);

  return { items, loading, error: null, hasMore: false, loadMore: () => {} };
};
