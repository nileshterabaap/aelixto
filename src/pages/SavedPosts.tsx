import { SwipeableView } from "@/components/SwipeableView";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Header } from "@/components/Header";
import { useCreatePostTrigger } from "@/hooks/useCreatePostTrigger";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { SavedThumbnailGrid } from "@/components/saved/SavedThumbnailGrid";
import { CollectionGrid } from "@/components/saved/CollectionGrid";
import { useCollections } from "@/hooks/useCollections";
import { SavedSkeleton } from "@/components/saved/SavedSkeleton";
import { DraftsGrid } from "@/components/saved/DraftsGrid";
import { useDrafts } from "@/hooks/useDrafts";

const isGenericPlaceholderThumbnail = (url?: string | null) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes("images.unsplash.com") || lower.includes("source.unsplash.com");
};

export default function SavedPosts() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [createPostOpen, setCreatePostOpen] = useState(false);
  useCreatePostTrigger(useCallback(() => setCreatePostOpen(true), []));
  const [activeTab, setActiveTab] = useState<"all" | "collections" | "drafts">("all");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !session) {
      navigate("/auth");
    }
  }, [session, loading, navigate]);

  const { data: savedPosts = [], isLoading } = useQuery({
    queryKey: ["saved-posts", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from("saves")
        .select(`
          post_id,
          posts (
            id, user_id, content, created_at, likes_count, saves_count,
            comments_count, reposts_count, media_type, media_url,
            platform, embed_html, thumbnail_url, title, preview_text,
            preview_title, preview_image_url, media_kind, aspect_ratio, suggested_height, is_public,
            profiles:user_id (username, display_name, avatar_url)
          )
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data
        .filter((item) => item.posts)
        .map((item: any) => {
          const post = item.posts;
          const profile = post.profiles;
          return {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            title: post.title || "",
            mediaType: post.media_type,
            mediaUrl: post.media_url,
            platform: post.platform,
            embed_html: post.embed_html,
            thumbnail_url: post.thumbnail_url,
            preview_text: post.preview_text,
            preview_title: post.preview_title,
            preview_image_url: post.preview_image_url,
            media_kind: post.media_kind,
            aspect_ratio: post.aspect_ratio,
            suggested_height: post.suggested_height,
            timestamp: new Date(post.created_at),
            likes: post.likes_count || 0,
            comments: post.comments_count || 0,
            shares: post.reposts_count || 0,
            saves: post.saves_count || 0,
            author: {
              name: profile?.display_name || profile?.username || "Unknown",
              username: profile?.username || "Unknown",
              avatar: profile?.avatar_url || "",
            },
            isRealPost: true,
          };
        });
    },
    enabled: !!session?.user?.id,
  });

  const {
    collections,
    isLoading: collectionsLoading,
    createCollection,
    deleteCollection,
    isCreating,
  } = useCollections(session?.user?.id);

  const { data: drafts = [] } = useDrafts(session?.user?.id);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["saved-posts"] }),
      queryClient.invalidateQueries({ queryKey: ["collections"] }),
      queryClient.invalidateQueries({ queryKey: ["post-drafts"] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    const targets = savedPosts.filter((post: any) => {
      const platform = (post.platform || "").toLowerCase();
      return ["article", "medium", "reddit"].includes(platform)
        && post.mediaUrl
        && (!post.thumbnail_url || isGenericPlaceholderThumbnail(post.thumbnail_url));
    });
    if (!targets.length) return;

    let cancelled = false;
    (async () => {
      for (const post of targets.slice(0, 6) as any[]) {
        if (cancelled) return;
        await supabase.functions.invoke("fetch-post-preview", {
          body: { postId: post.id, url: post.mediaUrl, platform: post.platform },
        }).catch(() => {});
      }
      if (!cancelled) {
        queryClient.invalidateQueries({ queryKey: ["saved-posts", session?.user?.id] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [savedPosts, queryClient, session?.user?.id]);

  if (loading || isLoading) {
    return (
      <SwipeableView rightRoute="/" rightLabel="Home">
        <div className="min-h-screen pb-20">
          <Header onCreatePost={() => setCreatePostOpen(true)} />
          <SavedSkeleton />
        </div>
      </SwipeableView>
    );
  }

  return (
    <SwipeableView rightRoute="/" rightLabel="Home">
    <div className="min-h-screen pb-20">
      <Header onCreatePost={() => setCreatePostOpen(true)} />

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="container max-w-2xl mx-auto px-4 py-6 animate-fade-in">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-muted/60 rounded-full p-1.5">
            {([
              { key: "drafts", label: "Drafts" },
              { key: "all", label: "Saved" },
              { key: "collections", label: "Collection" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 py-2.5 text-[15px] rounded-full transition-all ${
                  activeTab === key
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground font-medium"
                }`}
              >
                {key === "drafts" && drafts.length > 0
                  ? `Drafts (${drafts.length})`
                  : label}
              </button>
            ))}
          </div>

          {activeTab === "all" && (
            <SavedThumbnailGrid posts={savedPosts} userId={session?.user?.id} />
          )}
          {activeTab === "collections" && (
            <CollectionGrid
              collections={collections}
              userId={session?.user?.id}
              onCreateCollection={createCollection}
              onDeleteCollection={deleteCollection}
              isCreating={isCreating}
            />
          )}
          {activeTab === "drafts" && <DraftsGrid drafts={drafts} />}
        </main>
      </PullToRefresh>

      <CreatePostDialog open={createPostOpen} onOpenChange={setCreatePostOpen} />
    </div>
    </SwipeableView>
  );
}
