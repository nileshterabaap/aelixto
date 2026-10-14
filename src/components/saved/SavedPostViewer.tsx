import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  preview_text?: string | null;
  preview_title?: string | null;
  preview_image_url?: string | null;
  media_kind?: string | null;
  aspect_ratio?: number | null;
  suggested_height?: number | null;
  timestamp: Date | string;
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

const WINDOW_RADIUS = 6;
const WINDOW_STEP = 6;
const EXPAND_EDGE_PX = 900;

const getInitialRange = (length: number, index: number) => {
  if (length === 0) return { start: 0, end: -1 };
  const safeIndex = index >= 0 ? index : 0;
  return {
    start: Math.max(0, safeIndex - WINDOW_RADIUS),
    end: Math.min(length - 1, safeIndex + WINDOW_RADIUS),
  };
};

export const SavedPostViewer = ({
  posts,
  initialPostId,
  userId,
  onClose,
}: SavedPostViewerProps) => {
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingPrependAnchor = useRef<{ postId: string; top: number } | null>(null);

  const initialIdx = useMemo(
    () => posts.findIndex(p => p.id === initialPostId),
    [posts, initialPostId]
  );
  const [range, setRange] = useState(() => getInitialRange(posts.length, initialIdx));
  const visiblePosts = useMemo(
    () => posts.slice(range.start, range.end + 1),
    [posts, range.start, range.end]
  );

  const normalizeTimestamp = (value: Date | string) => {
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Confirm the target post exists in the list. If not, we still render the
  // list (avoid a blank modal) and skip anchoring.
  const hasTarget = initialIdx >= 0;

  useEffect(() => {
    postRefs.current.clear();
    pendingPrependAnchor.current = null;
    setRange(getInitialRange(posts.length, initialIdx));
  }, [posts.length, initialIdx, initialPostId]);

  useLayoutEffect(() => {
    const anchor = pendingPrependAnchor.current;
    const container = scrollContainerRef.current;
    if (!anchor || !container) return;

    const el = postRefs.current.get(anchor.postId);
    if (el) {
      container.scrollTop += el.getBoundingClientRect().top - anchor.top;
    }
    pendingPrependAnchor.current = null;
  }, [range.start]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (container.scrollTop < EXPAND_EDGE_PX && range.start > 0 && visiblePosts.length > 0) {
      const firstPost = visiblePosts[0];
      const firstEl = postRefs.current.get(firstPost.id);
      if (firstEl) {
        pendingPrependAnchor.current = { postId: firstPost.id, top: firstEl.getBoundingClientRect().top };
      }
      setRange(current => ({ ...current, start: Math.max(0, current.start - WINDOW_STEP) }));
    }

    const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    if (distanceFromBottom < EXPAND_EDGE_PX && range.end < posts.length - 1) {
      setRange(current => ({ ...current, end: Math.min(posts.length - 1, current.end + WINDOW_STEP) }));
    }
  }, [posts.length, range.end, range.start, visiblePosts]);

  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

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
  }, [initialPostId, hasTarget, range.start]);

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
      <div ref={scrollContainerRef} onScroll={handleScroll} className="h-[calc(100dvh-56px)] overflow-y-auto pb-8">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-6">
          {(() => {
            return visiblePosts.map((post, visibleIdx) => {
              const absoluteIdx = range.start + visibleIdx;
              const shouldHydrate = initialIdx >= 0 && Math.abs(absoluteIdx - initialIdx) <= 5;

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
                    timestamp: normalizeTimestamp(post.timestamp),
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
