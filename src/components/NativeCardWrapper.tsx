import { useState } from 'react';
import { AelixtoNativeCard } from '@/components/AelixtoNativeCard';
import { useUniversalContent } from '@/hooks/useUniversalContent';
import { useConnectedSocials } from '@/hooks/useConnectedSocials';
import { usePlatformActions } from '@/hooks/usePlatformActions';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyEmbed } from '@/components/LazyEmbed';
import { ImageViewTracker } from '@/components/ImageViewTracker';
import { deriveThumbnailFromUrl } from '@/lib/deriveThumbnail';

interface NativeCardWrapperProps {
  url: string;
  platform: string;
  postId: string;
  cachedData?: any;
  isRealPost?: boolean;
  // Internal Aelixto engagement
  likesCount?: number;
  commentsCount?: number;
  isLikedByUser?: boolean;
  onLike?: () => void;
  onComment?: () => void;
  thumbnailUrl?: string;
  previewTitle?: string;
  previewText?: string;
}

export const NativeCardWrapper = ({
  url,
  platform,
  postId,
  cachedData,
  isRealPost = false,
  likesCount = 0,
  commentsCount = 0,
  isLikedByUser = false,
  onLike,
  onComment,
  thumbnailUrl,
  previewTitle,
  previewText,
}: NativeCardWrapperProps) => {
  const [showConnectPrompt, setShowConnectPrompt] = useState(true);
  
  // Fetch content if not cached
  const { content: fetchedData, isLoading, error } = useUniversalContent(
    cachedData ? undefined : url, // Don't fetch if we have cached data
    postId
  );
  
  // Check connected socials
  const { connectedSocials, isPlatformConnected } = useConnectedSocials();
  const isConnected = isPlatformConnected(platform);
  
  // Platform actions
  const { likePlatform, isPending } = usePlatformActions();
  
  // Use cached data or fetched data
  const nativeData = cachedData || fetchedData;
  
  // Handle connect prompt dismissal (would persist to DB in full implementation)
  const handleDismissPrompt = () => {
    setShowConnectPrompt(false);
    // TODO: Persist to user settings in DB
  };
  
  const handleConnectPlatform = () => {
    // Navigate to settings for connection
    window.location.href = '/settings';
  };
  
  const handlePlatformLike = () => {
    if (isConnected) {
      likePlatform(platform, postId);
    }
  };
  
  const handlePlatformComment = () => {
    // Open external link for now - could implement in-app commenting later
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  
  // Show loading state with LazyEmbed skeleton
  if (isLoading && !nativeData) {
    return (
      <LazyEmbed
        thumbnailUrl={thumbnailUrl || deriveThumbnailFromUrl(url, platform)}
        previewTitle={previewTitle || 'Loading...'}
        previewText={previewText}
        platform={platform}
        mediaUrl={url}
      >
        <div className="w-full bg-black rounded-xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 bg-white/10 mb-1" />
                <Skeleton className="h-3 w-16 bg-white/10" />
              </div>
            </div>
            <Skeleton className="w-full aspect-square bg-white/10" />
          </div>
        </div>
      </LazyEmbed>
    );
  }
  
  // If we have data, render the native card
  if (nativeData) {
    const cardContent = (
      <AelixtoNativeCard
        data={{
          url: nativeData.url || url,
          platform: nativeData.platform || platform,
          media_type: nativeData.media_type || 'image',
          media_url: nativeData.media_url,
          thumbnail_url: nativeData.thumbnail_url || thumbnailUrl,
          title: nativeData.title,
          description: nativeData.description,
          author_name: nativeData.author_name,
          author_username: nativeData.author_username,
          author_avatar: nativeData.author_avatar,
          likes_count: nativeData.likes_count,
          comments_count: nativeData.comments_count,
          shares_count: nativeData.shares_count,
          views_count: nativeData.views_count,
        }}
        postId={postId}
        aelixtoLikes={likesCount}
        aelixtoComments={commentsCount}
        isLikedByUser={isLikedByUser}
        onAelixtoLike={onLike || (() => {})}
        onAelixtoComment={onComment || (() => {})}
        onPlatformLike={handlePlatformLike}
        onPlatformComment={handlePlatformComment}
        isPlatformConnected={isConnected}
        onConnectPlatform={handleConnectPlatform}
        onDismissConnectPrompt={handleDismissPrompt}
        showConnectPrompt={showConnectPrompt && !isConnected}
      />
    );
    
    if (isRealPost) {
      return (
        <ImageViewTracker postId={postId}>
          {cardContent}
        </ImageViewTracker>
      );
    }
    
    return cardContent;
  }
  
  // Error or no data - show fallback thumbnail card
  return (
    <LazyEmbed
      thumbnailUrl={thumbnailUrl || deriveThumbnailFromUrl(url, platform)}
      previewTitle={previewTitle || 'View on ' + platform}
      previewText={previewText}
      platform={platform}
      mediaUrl={url}
    >
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-black rounded-xl overflow-hidden p-8 text-center"
      >
        <p className="text-white/60 text-sm">
          {error ? 'Unable to load content' : 'Tap to view on ' + platform}
        </p>
      </a>
    </LazyEmbed>
  );
};
