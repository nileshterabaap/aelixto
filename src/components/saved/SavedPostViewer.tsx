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

  // Confirm the target post exists in the list. If not, we still render the
  // list (avoid a blank modal) and skip anchoring.
  const hasTarget = !!initialPostId && posts.some(p => p.id === initialPostId);

  // Keep the target anchored while posts above hydrate and resize.
  // The loop only runs after the target ref is mounted, and stops as soon as
  // the user interacts. It also clamps scrollTop to the valid range so we
  // never end up parked past the end of the content (which would show blank).
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasTarget) return;

    let cancelled = false;
    let started = false;
    let stopAt = 0;

    const onUserScroll = () => { cancelled = true; };
    const evts = ["wheel", "touchstart", "keydown"] as const;
    // Only treat as user-interrupt AFTER we've made our first scroll, so the
    // browser's own scrollTop write doesn't immediately cancel us.
    const attachInterrupts = () => {
      evts.forEach(e => container.addEventListener(e, onUserScroll, { passive: true }));
    };

    const tick = () => {
      if (cancelled) return;
      const target = postRefs.current.get(initialPostId);
      if (target) {
        if (!started) {
          started = true;
          stopAt = performance.now() + 1200;
          // Defer interrupt listeners by one frame so our own first write
          // doesn't trip them on some mobile browsers.
          requestAnimationFrame(attachInterrupts);
        }
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        const desired = Math.min(target.offsetTop, maxScroll);
        if (Math.abs(container.scrollTop - desired) > 1) {
          container.scrollTop = desired;
        }
      }
      // Keep polling until target appears (max 3s) or until anchor window ends.
      const deadline = started ? stopAt : performance.now() + 3000;
      if (performance.now() < deadline) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      evts.forEach(e => container.removeEventListener(e, onUserScroll));
    };
  }, [initialPostId, hasTarget]);

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
          {(() => {
            const initialIdx = posts.findIndex(p => p.id === initialPostId);
            return posts.map((post, idx) => {
              const shouldHydrate = initialIdx >= 0 && Math.abs(idx - initialIdx) <= 5;

              return (
                <div
                  key={post.id}
                  ref={(el) => {
                    if (el) postRefs.current.set(post.id, el);
                    else postRefs.current.delete(post.id);
                  }}
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
            });
          })()}
        </div>
      </div>
    </div>
  );
};
