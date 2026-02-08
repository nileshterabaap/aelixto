import { useState } from 'react';
import { AelixtoNativeCard } from '@/components/native-card';
import { useUniversalContent } from '@/hooks/useUniversalContent';
import { useConnectedSocials } from '@/hooks/useConnectedSocials';
import { usePlatformActions } from '@/hooks/usePlatformActions';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyEmbed } from '@/components/LazyEmbed';
import { ImageViewTracker } from '@/components/ImageViewTracker';
import { deriveThumbnailFromUrl } from '@/lib/deriveThumbnail';
import { supabase } from '@/integrations/supabase/client';

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Extract author info from Instagram description format
function extractAuthorFromDescription(description?: string, platform?: string): { authorName?: string; cleanDescription?: string } {
  if (!description || platform !== 'instagram') return {};
  
  // Pattern: "5,124 likes, 61 comments - doobmers on February 3, 2026: "smashable india..."
  const match = description.match(/^[\d,]+ likes?, [\d,]+ comments? - ([^\s:]+)/);
  if (match) {
    const authorName = match[1].trim();
    // Extract caption after the colon
    const captionMatch = description.match(/: [""]?(.+)$/s);
    const cleanDescription = captionMatch ? captionMatch[1].replace(/[""]$/, '').trim() : undefined;
    return { authorName, cleanDescription };
  }
  return {};
}

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
  const { isPlatformConnected } = useConnectedSocials();
  const isConnected = isPlatformConnected(platform);
  
  // Platform actions
  const { likePlatform } = usePlatformActions();
  
  // Use cached data or fetched data
  const nativeData = cachedData || fetchedData;
  
  // Handle connect prompt dismissal (would persist to DB in full implementation)
  const handleDismissPrompt = () => {
    setShowConnectPrompt(false);
    // TODO: Persist to user settings in DB
  };
  
  const handleConnectPlatform = async () => {
    // Start OAuth redirect flow
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Redirect to auth if not logged in
      window.location.href = '/auth';
      return;
    }
    
    // Navigate to settings for now - in future, could open OAuth popup
    window.location.href = `/settings?connect=${platform}`;
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
              <Skeleton className="h-10 w-10 rounded-full bg-zinc-800" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 bg-zinc-800 mb-1" />
                <Skeleton className="h-3 w-16 bg-zinc-800" />
              </div>
            </div>
            <Skeleton className="w-full aspect-square bg-zinc-800" />
          </div>
        </div>
      </LazyEmbed>
    );
  }
  
  // If we have data, render the native card
  if (nativeData) {
    // Try to extract author from previewText if not in nativeData
    const { authorName: extractedAuthor, cleanDescription } = extractAuthorFromDescription(
      decodeHtmlEntities(previewText || ''),
      platform
    );
    
    // Use decoded thumbnail URL
    const decodedThumb = decodeHtmlEntities(nativeData.thumbnail_url || thumbnailUrl || '');
    
    const cardContent = (
      <AelixtoNativeCard
        data={{
          url: nativeData.url || url,
          platform: nativeData.platform || platform,
          media_type: nativeData.media_type || 'image',
          media_url: nativeData.media_url,
          thumbnail_url: decodedThumb || undefined,
          title: nativeData.title,
          description: nativeData.description || cleanDescription,
          author_name: nativeData.author_name || extractedAuthor,
          author_username: nativeData.author_username || extractedAuthor,
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
