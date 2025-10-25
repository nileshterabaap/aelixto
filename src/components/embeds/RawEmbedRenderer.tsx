import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface RawEmbedRendererProps {
  embedHtml: string;
}

// Extract Instagram post URL from embed HTML
const extractInstagramUrl = (html: string): string | null => {
  const match = html.match(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)\/?/);
  return match ? match[0] : null;
};

// Extract Facebook post URL from embed HTML  
const extractFacebookUrl = (html: string): string | null => {
  const match = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+/);
  return match ? match[0] : null;
};

// Detect platform from embed HTML
const detectPlatform = (html: string): 'instagram' | 'facebook' | 'unknown' => {
  if (html.includes('instagram.com') || html.includes('cdninstagram.com')) {
    return 'instagram';
  }
  if (html.includes('facebook.com') || html.includes('fb.com')) {
    return 'facebook';
  }
  return 'unknown';
};

export const RawEmbedRenderer = ({ embedHtml }: RawEmbedRendererProps) => {
  const [embedUrl, setEmbedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const platform = detectPlatform(embedHtml);

  useEffect(() => {
    const fetchEmbed = async () => {
      try {
        setIsLoading(true);
        setError(false);

        if (platform === 'instagram') {
          const postUrl = extractInstagramUrl(embedHtml);
          if (postUrl) {
            // Use Instagram oEmbed API to get iframe embed
            const response = await fetch(
              `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&access_token=1234567890`,
              { mode: 'no-cors' }
            );
            
            // Since we can't read the response in no-cors mode, use direct iframe approach
            const embedId = postUrl.split('/')[4];
            setEmbedUrl(`https://www.instagram.com/p/${embedId}/embed/`);
          }
        } else if (platform === 'facebook') {
          const postUrl = extractFacebookUrl(embedHtml);
          if (postUrl) {
            // Use Facebook's iframe embed
            setEmbedUrl(`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(postUrl)}&width=500`);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to process embed:', err);
        setError(true);
        setIsLoading(false);
      }
    };

    if (embedHtml) {
      fetchEmbed();
    }
  }, [embedHtml, platform]);

  if (error) {
    return (
      <div className="rounded-2xl overflow-hidden bg-muted p-4 text-center text-sm text-muted-foreground">
        Unable to load embed. The content may be unavailable.
      </div>
    );
  }

  if (isLoading || !embedUrl) {
    return <Skeleton className="w-full h-[500px] rounded-2xl" />;
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-background" style={{ maxWidth: '540px', margin: '0 auto' }}>
      <div style={{ 
        height: '620px', 
        overflow: 'hidden',
        position: 'relative'
      }}>
        <iframe
          src={embedUrl}
          className="w-full border-0"
          style={{ 
            height: '1200px',
            marginTop: '0px',
            display: 'block'
          }}
          scrolling="no"
          frameBorder="0"
          allowTransparency={true}
          allow="encrypted-media"
        />
      </div>
    </div>
  );
};
