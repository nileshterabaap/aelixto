import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HydratedFeedPost } from "@/components/HydratedFeedPost";
import { markPostsSeenImmediate } from "@/hooks/useMarkPostSeen";

interface SavedPost {
  id: string;
  user_id: string;
  content: string;
  title: string;
  mediaType?: string;
  mediaUrl?: string;
  platform?: string;
  embed_html?: string;
  thumbnail_url?: string;
  timestamp: Date;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  author: { name: string; username: string; avatar: string };
  isRealPost: boolean;
}

interface SavedPostViewerProps {
  posts: SavedPost[];
  initialPostId: string;
  userId?: string;
  onClose: () => void;
}

export const SavedPostViewer = ({
  posts,
  initialPostId,
  userId,
  onClose,
}: SavedPostViewerProps) => {
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Keep the target anchored while posts above hydrate and resize.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !initialPostId) return;

    let cancelled = false;
    const stopAt = performance.now() + 1800;
    const onUserScroll = () => { cancelled = true; };
    const evts = ["wheel", "touchstart", "keydown"] as const;
    evts.forEach(e => container.addEventListener(e, onUserScroll, { passive: true }));

    const tick = () => {
      if (cancelled) return;
      const target = postRefs.current.get(initialPostId);
      if (target) {
        const desired = target.offsetTop;
        if (Math.abs(container.scrollTop - desired) > 1) {
          container.scrollTop = desired;
        }
      }
      if (performance.now() < stopAt) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      evts.forEach(e => container.removeEventListener(e, onUserScroll));
    };
  }, [initialPostId]);

  // Mark all viewed saved posts as seen
  useEffect(() => {
    if (userId && posts.length > 0) {
      markPostsSeenImmediate(userId, posts.map(p => p.id));
    }
  }, [userId, posts]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-sm">Saved Posts</span>
          <div className="w-10" />
        </div>
      </div>

      {/* Scrollable posts */}
      <div ref={scrollContainerRef} className="h-[calc(100vh-56px)] overflow-y-auto pb-8">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-6">
          {posts.map((post, idx) => {
            const initialIdx = posts.findIndex(p => p.id === initialPostId);
            const shouldHydrate = initialIdx >= 0 && Math.abs(idx - initialIdx) <= 5;

            return (
              <div
                key={post.id}
                ref={(el) => { if (el) postRefs.current.set(post.id, el); }}
              >
                <HydratedFeedPost
                  post={{
                    ...post,
                    likes_count: post.likes || 0,
                    comments_count: post.comments || 0,
                    reposts_count: post.shares || 0,
                    saves_count: post.saves || 0,
                  } as any}
                  userId={userId}
                  startHydrated={shouldHydrate}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
