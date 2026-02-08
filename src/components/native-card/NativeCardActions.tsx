import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NativeCardActionsProps {
  platform: string;
  // Aelixto engagement
  aelixtoLikes: number;
  aelixtoComments: number;
  isLikedByUser: boolean;
  onAelixtoLike: () => void;
  onAelixtoComment: () => void;
  // Platform engagement
  platformLikes?: number;
  platformComments?: number;
  isPlatformConnected: boolean;
  onPlatformLike?: () => void;
  onPlatformComment?: () => void;
  postUrl?: string;
}

export const NativeCardActions = ({
  platform,
  aelixtoLikes,
  aelixtoComments,
  isLikedByUser,
  onAelixtoLike,
  onAelixtoComment,
  platformLikes,
  platformComments,
  isPlatformConnected,
  onPlatformLike,
  onPlatformComment,
  postUrl,
}: NativeCardActionsProps) => {
  const handleShare = () => {
    if (postUrl) {
      window.open(postUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="px-4 py-2 flex items-center justify-between">
      {/* Left side actions */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onAelixtoLike}
          className="group p-1 -m-1"
          aria-label={isLikedByUser ? 'Unlike' : 'Like'}
        >
          <Heart 
            className={cn(
              "h-6 w-6 transition-colors",
              isLikedByUser 
                ? "fill-red-500 text-red-500" 
                : "text-gray-900 hover:text-gray-600"
            )} 
          />
        </button>
        <button 
          onClick={onAelixtoComment}
          className="group p-1 -m-1"
          aria-label="Comment"
        >
          <MessageCircle className="h-6 w-6 text-gray-900 hover:text-gray-600 transition-colors" />
        </button>
        <button 
          onClick={handleShare}
          className="group p-1 -m-1"
          aria-label="Share"
        >
          <Send className="h-6 w-6 text-gray-900 hover:text-gray-600 transition-colors -rotate-45" />
        </button>
      </div>
      
      {/* Right side bookmark */}
      <button 
        className="group p-1 -m-1"
        aria-label="Save"
      >
        <Bookmark className="h-6 w-6 text-gray-900 hover:text-gray-600 transition-colors" />
      </button>
    </div>
  );
};
