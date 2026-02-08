import { useState } from 'react';
import { NativeCardHeader } from './NativeCardHeader';
import { NativeCardMedia } from './NativeCardMedia';
import { NativeCardActions } from './NativeCardActions';
import { ConnectPromptBanner } from './ConnectPromptBanner';

export interface NativeCardData {
  url: string;
  platform: string;
  media_type: 'video' | 'image' | 'text' | 'carousel';
  media_url?: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  author_name?: string;
  author_username?: string;
  author_avatar?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  views_count?: number;
}

interface AelixtoNativeCardProps {
  data: NativeCardData;
  postId: string;
  // Internal Aelixto engagement
  aelixtoLikes: number;
  aelixtoComments: number;
  isLikedByUser: boolean;
  onAelixtoLike: () => void;
  onAelixtoComment: () => void;
  // Platform engagement (via Outstand)
  onPlatformLike?: () => void;
  onPlatformComment?: () => void;
  isPlatformConnected?: boolean;
  onConnectPlatform?: () => void;
  onDismissConnectPrompt?: () => void;
  showConnectPrompt?: boolean;
}

// Helper to proxy images through img-proxy
function getProxiedUrl(url?: string): string {
  if (!url) return '/placeholder.svg';
  
  // Skip if already proxied or is a storage URL
  if (url.includes('/storage/v1/object/public/') || url.includes('img-proxy')) {
    return url;
  }
  
  // Only proxy https URLs
  if (!url.startsWith('https://')) {
    return url;
  }
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/img-proxy?u=${encodeURIComponent(url)}`;
}

export const AelixtoNativeCard = ({
  data,
  postId,
  aelixtoLikes,
  aelixtoComments,
  isLikedByUser,
  onAelixtoLike,
  onAelixtoComment,
  onPlatformLike,
  onPlatformComment,
  isPlatformConnected = false,
  onConnectPlatform,
  onDismissConnectPrompt,
  showConnectPrompt = false,
}: AelixtoNativeCardProps) => {
  const caption = data.description || data.title || '';
  const truncateLength = 150;
  const needsTruncation = caption.length > truncateLength;
  const [showFullCaption, setShowFullCaption] = useState(false);
  const truncatedCaption = needsTruncation 
    ? caption.substring(0, truncateLength) + '...' 
    : caption;

  // Get display name - use author_username if no author_name
  const displayName = data.author_name || data.author_username;

  return (
    <div className="w-full bg-black rounded-xl overflow-hidden border border-white/10">
      {/* Connect Platform Prompt */}
      {showConnectPrompt && !isPlatformConnected && onConnectPlatform && onDismissConnectPrompt && (
        <ConnectPromptBanner
          platform={data.platform}
          onConnect={onConnectPlatform}
          onDismiss={onDismissConnectPrompt}
        />
      )}

      {/* Author Header */}
      <NativeCardHeader
        platform={data.platform}
        authorName={data.author_name}
        authorUsername={data.author_username}
        authorAvatar={data.author_avatar}
        postUrl={data.url}
        proxyFn={getProxiedUrl}
      />

      {/* Media Content */}
      <NativeCardMedia
        mediaType={data.media_type}
        mediaUrl={data.media_url}
        thumbnailUrl={data.thumbnail_url}
        caption={caption}
        title={data.title}
        proxyFn={getProxiedUrl}
      />

      {/* Actions */}
      <NativeCardActions
        platform={data.platform}
        aelixtoLikes={aelixtoLikes}
        aelixtoComments={aelixtoComments}
        isLikedByUser={isLikedByUser}
        onAelixtoLike={onAelixtoLike}
        onAelixtoComment={onAelixtoComment}
        platformLikes={data.likes_count}
        platformComments={data.comments_count}
        isPlatformConnected={isPlatformConnected}
        onPlatformLike={onPlatformLike}
        onPlatformComment={onPlatformComment}
      />

      {/* Caption */}
      {data.media_type !== 'text' && caption && (
        <div className="px-4 pb-4">
          <p className="text-sm text-white/80 leading-relaxed">
            {displayName && (
              <span className="font-semibold text-white mr-1">
                {displayName}
              </span>
            )}
            {showFullCaption ? caption : truncatedCaption}
          </p>
          {needsTruncation && (
            <button 
              onClick={() => setShowFullCaption(!showFullCaption)}
              className="text-xs text-white/40 mt-1 hover:text-white/60"
            >
              {showFullCaption ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Re-export for backwards compatibility
export type { NativeCardData as NativeCardDataType };
