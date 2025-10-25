import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Instagram } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CleanInstagramCardProps {
  postUrl: string;
}

interface OEmbedData {
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  title: string;
  provider_url: string;
  url: string;
}

export const CleanInstagramCard = ({ postUrl }: CleanInstagramCardProps) => {
  const [data, setData] = useState<OEmbedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOEmbedData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('[CleanInstagramCard] Fetching oEmbed for:', postUrl);

        const { data: response, error: functionError } = await supabase.functions.invoke('ig-oembed-json', {
          body: { url: postUrl }
        });

        if (functionError) {
          console.error('[CleanInstagramCard] Function error:', functionError);
          setError(functionError.message || 'Failed to load Instagram data');
          setIsLoading(false);
          return;
        }

        if (response?.error) {
          console.error('[CleanInstagramCard] API error:', response.error);
          setError(response.error);
          setIsLoading(false);
          return;
        }

        console.log('[CleanInstagramCard] Successfully fetched data:', response);
        setData(response);
      } catch (err) {
        console.error('[CleanInstagramCard] Error:', err);
        setError('Failed to load Instagram preview');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOEmbedData();
  }, [postUrl]);

  if (isLoading) {
    return (
      <Card className="overflow-hidden max-w-md mx-auto">
        <Skeleton className="w-full aspect-[4/5]" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="overflow-hidden max-w-md mx-auto p-6">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {error || 'Unable to load Instagram preview'}
          </AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={() => window.open(postUrl, '_blank', 'noopener,noreferrer')}
        >
          <Instagram className="h-4 w-4" />
          Open on Instagram
          <ExternalLink className="h-4 w-4 ml-auto" />
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden max-w-md mx-auto hover:shadow-lg transition-shadow">
      {/* Thumbnail */}
      {data.thumbnail_url && (
        <div className="relative aspect-[4/5] bg-muted overflow-hidden">
          <img
            src={data.thumbnail_url}
            alt={data.title || 'Instagram post'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Instagram className="h-4 w-4 text-white" />
            <span className="text-xs font-medium text-white">Instagram</span>
          </div>
        </div>
      )}

      {/* Author Info */}
      <div className="p-4 space-y-3">
        {data.author_name && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
              <Instagram className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{data.author_name}</p>
              <p className="text-xs text-muted-foreground">Instagram Post</p>
            </div>
          </div>
        )}

        {/* View on Instagram Button */}
        <Button 
          variant="default" 
          className="w-full gap-2"
          onClick={() => window.open(postUrl, '_blank', 'noopener,noreferrer')}
        >
          View on Instagram
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
