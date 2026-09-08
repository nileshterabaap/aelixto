import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import youtubeIcon from "@/assets/platforms/youtube.svg";
import instagramIcon from "@/assets/platforms/instagram.svg";
import xIcon from "@/assets/platforms/x.svg";
import redditIcon from "@/assets/platforms/reddit.svg";
import pinterestIcon from "@/assets/platforms/pinterest.svg";
import tiktokIcon from "@/assets/platforms/tiktok.svg";
import facebookIcon from "@/assets/platforms/facebook.svg";
import quoraIcon from "@/assets/platforms/quora.svg";
import mediumIcon from "@/assets/platforms/medium.svg";
import blogIcon from "@/assets/platforms/blog.svg";
import spotifyIcon from "@/assets/platforms/spotify.svg";
import threadsIcon from "@/assets/platforms/threads.svg";
import linkedinIcon from "@/assets/platforms/linkedin.svg";
import articlesIcon from "@/assets/platforms/articles.svg";
import externalIcon from "@/assets/platforms/external.svg";

export type PlatformTab = {
  key: string;
  label: string;
  icon: string;
  count: number;
};

const PLATFORM_META: Record<string, { label: string; icon: string }> = {
  youtube: { label: "YouTube", icon: youtubeIcon },
  instagram: { label: "Instagram", icon: instagramIcon },
  x: { label: "X", icon: xIcon },
  twitter: { label: "X", icon: xIcon },
  reddit: { label: "Reddit", icon: redditIcon },
  pinterest: { label: "Pinterest", icon: pinterestIcon },
  facebook: { label: "Facebook", icon: facebookIcon },
  tiktok: { label: "TikTok", icon: tiktokIcon },
  quora: { label: "Quora", icon: quoraIcon },
  medium: { label: "Medium", icon: mediumIcon },
  blog: { label: "Blogs", icon: blogIcon },
  spotify: { label: "Spotify", icon: spotifyIcon },
  threads: { label: "Threads", icon: threadsIcon },
  linkedin: { label: "LinkedIn", icon: linkedinIcon },
  article: { label: "Articles 📜", icon: articlesIcon },
  external: { label: "External 🔗", icon: externalIcon },
};

export const useUserPlatformTabs = (userId: string | undefined) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<string>("");

  const { data: tabs = [], isLoading } = useQuery({
    queryKey: ["user-platform-tabs", userId],
    enabled: !!userId,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
    queryFn: async (): Promise<PlatformTab[]> => {
      const { data, error } = await supabase.rpc("get_user_platform_counts", {
        target_user: userId!,
      });
      if (error) throw error;

      const [{ data: recentPosts }, { data: recentReposts }] = await Promise.all([
        supabase
          .from("posts")
          .select("platform, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("reposts")
          .select("created_at, post_id")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const latestByPlatform: Record<string, string> = {};
      (recentPosts || []).forEach((p: any) => {
        if (p.platform && !latestByPlatform[p.platform]) {
          latestByPlatform[p.platform] = p.created_at;
        }
      });

      if (recentReposts && recentReposts.length > 0) {
        const postIds = recentReposts.map((r: any) => r.post_id);
        const { data: repostedPosts } = await supabase
          .from("posts")
          .select("id, platform")
          .in("id", postIds);

        const platformByPostId: Record<string, string> = {};
        (repostedPosts || []).forEach((p: any) => {
          if (p.platform) platformByPostId[p.id] = p.platform;
        });

        recentReposts.forEach((r: any) => {
          const platform = platformByPostId[r.post_id];
          if (platform && (!latestByPlatform[platform] || r.created_at > latestByPlatform[platform])) {
            latestByPlatform[platform] = r.created_at;
          }
        });
      }

      return (data || [])
        .map((item: any) => ({
          key: item.platform,
          label: PLATFORM_META[item.platform]?.label || item.platform,
          icon: PLATFORM_META[item.platform]?.icon || externalIcon,
          count: item.post_count,
          _latest: latestByPlatform[item.platform] || "1970-01-01",
        }))
        .sort((a: any, b: any) => b._latest.localeCompare(a._latest))
        .map(({ _latest, ...tab }: any) => tab as PlatformTab);
    },
  });

  // Initialize active tab from URL / first tab whenever tabs change.
  useEffect(() => {
    if (!tabs.length) return;
    const urlPlatform = searchParams.get("platform");
    if (urlPlatform && tabs.some((t) => t.key === urlPlatform)) {
      setActiveTabState((prev) => (prev === urlPlatform ? prev : urlPlatform));
    } else {
      setActiveTabState((prev) => (prev && tabs.some((t) => t.key === prev) ? prev : tabs[0].key));
    }
  }, [tabs, searchParams]);

  const loading = !!userId && isLoading && tabs.length === 0;

  const setActiveTab = (platform: string) => {
    setActiveTabState(platform);
    setSearchParams({ platform }, { replace: true });
  };

  return { tabs, activeTab, setActiveTab, loading };
};
