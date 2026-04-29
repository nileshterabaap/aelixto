import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HydratedFeedPost } from "@/components/HydratedFeedPost";

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

  useEffect(() => {
    setTimeout(() => {
      const el = postRefs.current.get(initialPostId);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    }, 100);
  }, [initialPostId]);

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
      <div className="h-[calc(100vh-56px)] overflow-y-auto pb-8">
        <div className="mx-auto max-w-2xl px-4 py-4 space-y-6">
          {posts.map((post, idx) => {
            const initialIdx = posts.findIndex(p => p.id === initialPostId);
            const shouldHydrate = initialIdx >= 0 && Math.abs(idx - initialIdx) <= 1;

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
