import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import youtubeIcon from "@/assets/youtube-icon.png";
import instagramIcon from "@/assets/instagram-icon.png";
import twitterIcon from "@/assets/twitter-icon.png";
import redditIcon from "@/assets/reddit-icon.png";
import pinterestIcon from "@/assets/pinterest-icon.png";
import tiktokIcon from "@/assets/tiktok-icon.png";

export type PlatformTab = {
  key: string;
  label: string;
  icon: string;
  count: number;
};

const PLATFORM_META: Record<string, { label: string; icon: string }> = {
  youtube: { label: "YouTube", icon: youtubeIcon },
  instagram: { label: "Instagram", icon: instagramIcon },
  x: { label: "X", icon: twitterIcon },
  twitter: { label: "X", icon: twitterIcon },
  reddit: { label: "Reddit", icon: redditIcon },
  pinterest: { label: "Pinterest", icon: pinterestIcon },
  facebook: { label: "Facebook", icon: instagramIcon },
  tiktok: { label: "TikTok", icon: tiktokIcon },
  quora: { label: "Quora", icon: redditIcon },
  medium: { label: "Medium", icon: youtubeIcon },
  blog: { label: "Blogs", icon: youtubeIcon },
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

        const platformTabs: PlatformTab[] = (data || []).map((item: any) => ({
          key: item.platform,
          label: PLATFORM_META[item.platform]?.label || item.platform,
          icon: PLATFORM_META[item.platform]?.icon || youtubeIcon,
          count: item.post_count,
        }));

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
