import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  const [tabs, setTabs] = useState<PlatformTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState<string>("");

  useEffect(() => {
    if (!userId) {
      setTabs([]);
      setLoading(false);
      return;
    }

    const fetchPlatformCounts = async () => {
      try {
        const { data, error } = await supabase.rpc("get_user_platform_counts", {
          target_user: userId,
        });

        if (error) throw error;

        // Fetch the most recent post date per platform to sort by recency
        const { data: recentPosts } = await supabase
          .from("posts")
          .select("platform, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(500);

        const latestByPlatform: Record<string, string> = {};
        (recentPosts || []).forEach((p: any) => {
          if (p.platform && !latestByPlatform[p.platform]) {
            latestByPlatform[p.platform] = p.created_at;
          }
        });

        const platformTabs: PlatformTab[] = (data || [])
          .map((item: any) => ({
            key: item.platform,
            label: PLATFORM_META[item.platform]?.label || item.platform,
            icon: PLATFORM_META[item.platform]?.icon || externalIcon,
            count: item.post_count,
            _latest: latestByPlatform[item.platform] || "1970-01-01",
          }))
          .sort((a: any, b: any) => b._latest.localeCompare(a._latest))
          .map(({ _latest, ...tab }: any) => tab as PlatformTab);

        setTabs(platformTabs);

        // Set active tab from URL or default to first tab
        const urlPlatform = searchParams.get("platform");
        if (urlPlatform && platformTabs.some((t) => t.key === urlPlatform)) {
          setActiveTabState(urlPlatform);
        } else if (platformTabs.length > 0) {
          setActiveTabState(platformTabs[0].key);
        }
      } catch (error) {
        console.error("Error fetching platform counts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlatformCounts();
  }, [userId]);

  const setActiveTab = (platform: string) => {
    setActiveTabState(platform);
    setSearchParams({ platform }, { replace: true });
  };

  return { tabs, activeTab, setActiveTab, loading };
};
