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

function formatCount(count?: number): string {
  if (!count) return '0';
  return count.toLocaleString();
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
  const displayName = data.author_name || data.author_username;
  const platformName = data.platform.charAt(0).toUpperCase() + data.platform.slice(1);

  return (
    <div className="w-full bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {/* Instagram-style Header */}
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

      {/* View more on Platform link */}
      <div className="px-4 py-2 border-t border-gray-100">
        <a 
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0095f6] text-sm font-medium hover:text-[#00376b] transition-colors"
        >
          View more on {platformName}
        </a>
      </div>

      {/* Platform-style Actions (Heart, Comment, Share, Bookmark) */}
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
        postUrl={data.url}
      />

      {/* Like count */}
      {data.likes_count !== undefined && data.likes_count > 0 && (
        <div className="px-4 pb-2">
          <span className="text-sm font-semibold text-gray-900">
            {formatCount(data.likes_count)} likes
          </span>
        </div>
      )}

      {/* Add a comment input (Instagram style) */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-400">Add a comment...</span>
        {/* Platform icon */}
        <img 
          src={`/src/assets/platforms/${data.platform === 'twitter' ? 'x' : data.platform}.svg`}
          alt={platformName}
          className="w-5 h-5 opacity-60"
        />
      </div>

      {/* Connect prompt - shows as floating banner if not connected */}
      {showConnectPrompt && !isPlatformConnected && onConnectPlatform && onDismissConnectPrompt && (
        <ConnectPromptBanner
          platform={data.platform}
          onConnect={onConnectPlatform}
          onDismiss={onDismissConnectPrompt}
        />
      )}
    </div>
  );
};

// Re-export for backwards compatibility
export type { NativeCardData as NativeCardDataType };
