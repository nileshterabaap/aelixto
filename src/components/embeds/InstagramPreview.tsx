import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface InstagramPreviewProps {
  url: string;
}

interface OgData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  canonicalUrl?: string;
}

export const InstagramPreview = ({ url }: InstagramPreviewProps) => {
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOgData = async () => {
      try {
        console.log('[InstagramPreview] Unfurling URL:', url);
        const { data, error } = await supabase.functions.invoke('unfurl-url', {
          body: { url }
        });

        if (!error && data) {
          setOgData(data);
        } else {
          setOgData({});
        }
      } catch (err) {
        console.error('[InstagramPreview] Error fetching OG data:', err);
        setOgData({});
      } finally {
        setLoading(false);
      }
    };

    fetchOgData();
  }, [url]);

  if (loading) {
    return (
      <Card className="overflow-hidden rounded-2xl">
        <Skeleton className="w-full aspect-square" />
        <div className="p-4 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    );
  }

  let displayUrl = url;
  let domain = 'instagram.com';
  
  try {
    displayUrl = ogData?.canonicalUrl || url;
    domain = new URL(displayUrl).hostname.replace('www.', '');
  } catch (err) {
    console.error('[InstagramPreview] Invalid URL:', displayUrl);
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-2 border-foreground">
      {ogData?.image ? (
        <div className="aspect-square w-full overflow-hidden bg-muted">
          <img
            src={ogData.image}
            alt={ogData.title || 'Instagram post'}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : (
        <div className="aspect-square w-full bg-muted flex items-center justify-center">
          <svg
            className="w-16 h-16 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </div>
      )}
      <div className="p-4 space-y-2">
        {ogData?.title && (
          <h3 className="font-semibold text-base line-clamp-2">
            {ogData.title}
          </h3>
        )}
        {ogData?.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {ogData.description}
          </p>
        )}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {ogData?.siteName || domain}
          </span>
          <Button variant="outline" size="sm" asChild>
            <a href={displayUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              View on Instagram
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
};
