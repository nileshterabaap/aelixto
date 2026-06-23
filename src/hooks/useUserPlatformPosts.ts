import { useCallback, useEffect, useMemo, useState } from "react";
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
  preview_text?: string | null;
  preview_title?: string | null;
  preview_image_url?: string | null;
  is_public: boolean;
  is_repost: boolean;
  original_user_id: string | null;
  profile_username?: string | null;
  profile_display_name?: string | null;
  profile_avatar_url?: string | null;
}

const THUMB_BACKFILL_PLATFORMS = new Set(["instagram", "facebook", "reddit", "threads", "linkedin", "tiktok", "article", "medium"]);
const inflightBackfills = new Set<string>();

const isLikelyExpiringMetaCdnUrl = (url?: string | null) => {
  if (!url) return false;
  // Already permanent (our storage)
  if (url.includes("/storage/v1/object/public/post-thumbnails/") || url.includes("post-thumbnails")) {
    return false;
  }
  // Meta CDNs that commonly rotate/expire tokens
  return (
    url.includes("fbcdn.net") ||
    url.includes("cdninstagram.com") ||
    url.includes("scontent-")
  );
};

const isGenericPlaceholderThumbnail = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes("images.unsplash.com") || lower.includes("source.unsplash.com");
};

const hasUsableTextThumbnail = (post: PlatformPost) => {
  const title = (post.title || "").trim();
  const content = (post.content || "").trim();
  const previewTitle = (post.preview_title || "").trim();
  const previewText = (post.preview_text || "").trim();
  const hasTitle = !!title && title !== "Reddit Post" && title !== "Web Post" && title !== "Threads" && !/^(?:@?[^\s]+|.+) on Threads$/i.test(title);
  const hasPreviewTitle = !!previewTitle && previewTitle !== "Reddit Post" && previewTitle !== "Web Post" && previewTitle !== "Threads";
  return !!content || hasTitle || hasPreviewTitle || (!!previewText && previewText !== "Threads");
};

async function backfillThumbnail(post: PlatformPost) {
  if (!post.media_url || !post.platform) return;
  const platform = post.platform.toLowerCase();
  if (!THUMB_BACKFILL_PLATFORMS.has(platform)) return;
  if (post.thumbnail_url && !isGenericPlaceholderThumbnail(post.thumbnail_url)) return;
  // For Reddit/Instagram/Facebook/TikTok, ALWAYS try to recover the real
  // media thumbnail even when we have usable text — an image post should
  // show the image, not its title. For pure text platforms (Threads, X,
  // article) we can skip backfill when text is already usable.
  const imageFirstPlatform =
    platform === "reddit" || platform === "instagram" ||
    platform === "facebook" || platform === "linkedin" || platform === "tiktok" || platform === "pinterest";
  if (!post.thumbnail_url && !imageFirstPlatform && hasUsableTextThumbnail(post)) return;

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

async function persistExistingThumbnail(post: PlatformPost) {
  if (!post.thumbnail_url) return;
  const platform = (post.platform || "").toLowerCase();
  if (!THUMB_BACKFILL_PLATFORMS.has(platform)) return;
  if (!isLikelyExpiringMetaCdnUrl(post.thumbnail_url)) return;

  const key = `${post.id}:persist:${platform}`;
  if (inflightBackfills.has(key)) return;
  inflightBackfills.add(key);

  try {
    await supabase.functions.invoke("store-thumbnail", {
      body: {
        postId: post.id,
        imageUrl: post.thumbnail_url,
      },
    });
  } catch {
    // silent: best-effort background improvement
  } finally {
    inflightBackfills.delete(key);
  }
}

export const useUserPlatformPosts = (userId: string | undefined, platform: string | undefined) => {
  const queryClient = useQueryClient();
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    setVisibleCount(50);
  }, [userId, platform]);

  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ["platform-posts", userId, platform],
    queryFn: async () => {
      if (!userId || !platform) return [];

      const all: PlatformPost[] = [];
      let cursor: string | null = null;

      for (let page = 0; page < 20; page += 1) {
        const { data, error } = await supabase.rpc("get_user_platform_posts", {
          target_user: userId,
          platform_name: platform,
          limit_count: 50,
          cursor,
        });

        if (error) throw error;

        const pageItems = (data || []) as PlatformPost[];
        all.push(...pageItems.map((post) => ({
          ...post,
          preview_text: (post as any).preview_text ?? null,
          preview_title: (post as any).preview_title ?? null,
          preview_image_url: (post as any).preview_image_url ?? null,
        })));
        if (pageItems.length < 50) break;
        cursor = pageItems[pageItems.length - 1]?.created_at || null;
        if (!cursor) break;
      }

      const postIds = all.map((post) => post.id).filter(Boolean);
      const { data: postDetails } = postIds.length
        ? await supabase
            .from("posts")
            .select("id, title, content, thumbnail_url, preview_text, preview_title, preview_image_url")
            .in("id", postIds)
        : { data: [] };

      const detailsById = new Map((postDetails || []).map((post) => [post.id, post]));
      const enrichedPosts = all.map((post) => ({
        ...post,
        ...(detailsById.get(post.id) || {}),
      }));

      const userIds = [...new Set(enrichedPosts.map((post) => post.user_id).filter(Boolean))];
      if (userIds.length === 0) return enrichedPosts;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", userIds);

      const profileByUserId = new Map(
        (profiles || []).map((profile) => [profile.user_id, profile])
      );

      return enrichedPosts.map((post) => {
        const profile = profileByUserId.get(post.user_id);
        return {
          ...post,
          profile_username: profile?.username || null,
          profile_display_name: profile?.display_name || null,
          profile_avatar_url: profile?.avatar_url || null,
        };
      });
    },
    enabled: !!userId && !!platform,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });

  // Background thumbnail backfill for platforms that can expose media previews after creation.
  useEffect(() => {
    if (!items.length) return;

    const platformLower = (platform || "").toLowerCase();
    if (!THUMB_BACKFILL_PLATFORMS.has(platformLower)) return;

    const imageFirstPlatform =
      platformLower === "reddit" || platformLower === "instagram" ||
      platformLower === "facebook" || platformLower === "linkedin" || platformLower === "tiktok" || platformLower === "pinterest";
    const missing = items.filter((p) => {
      if (!p.media_url) return false;
      const noThumb = !p.thumbnail_url || isGenericPlaceholderThumbnail(p.thumbnail_url);
      if (!noThumb) return false;
      if (imageFirstPlatform) return true;
      return !hasUsableTextThumbnail(p);
    });
    const expiring = items.filter((p) => isLikelyExpiringMetaCdnUrl(p.thumbnail_url));
    if (!missing.length && !expiring.length) return;

    let cancelled = false;

    (async () => {
      // small, safe concurrency (1-by-1) to avoid rate limits
      for (const p of missing.slice(0, 6)) {
        if (cancelled) return;
        await backfillThumbnail(p);
      }

      // Also persist any currently-visible Meta CDN thumbnails so they don't break weeks later
      for (const p of expiring.slice(0, 6)) {
        if (cancelled) return;
        await persistExistingThumbnail(p);
      }

      if (cancelled) return;
      // Refresh the grid data once backfills likely completed
      queryClient.invalidateQueries({ queryKey: ["platform-posts", userId, platform] });
    })();

    return () => {
      cancelled = true;
    };
  }, [items, platform, queryClient, userId]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < items.length;
  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(current + 50, items.length));
  }, [items.length]);

  return { items: visibleItems, loading, error: null, hasMore, loadMore };
};
