import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import RedditEmbed from "@/components/embeds/RedditEmbed";
import { ArticleContentEmbed } from "./ArticleContentEmbed";
import { LinkPreviewCard } from "./LinkPreviewCard";

interface ArticleEmbedProps {
  url: string;
  onFaviconLoaded?: (favicon: string) => void;
}

interface UnfurlResult {
  kind: 'reddit-post' | 'medium-article' | 'generic-article' | 'quora-post';
  resolvedUrl: string;
  site: {
    name: string;
    domain: string;
    favicon: string;
  };
  meta: {
    title: string;
    description: string;
    image: string | null;
    publishedTime: string | null;
  };
  content: {
    html: string;
  };
}

// Clean malformed URLs (handle duplicates, spaces, etc.)
const cleanUrl = (url: string): string => {
  if (!url) return url;
  
  try {
    // Trim and take first segment if there are spaces/duplicates
    const cleaned = url.trim().split(/\s+/)[0];
    
    // Ensure it has a protocol
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      return `https://${cleaned}`;
    }
    
    return cleaned;
  } catch {
    return url;
  }
};

// Determine renderer type based on URL
const resolveRenderer = (url: string): 'reddit' | 'quora' | 'article' => {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('reddit.com') || urlLower.includes('redd.it')) {
    return 'reddit';
  }
  
  if (urlLower.includes('quora.com')) {
    return 'quora';
  }
  
  return 'article';
};

export const ArticleEmbed = ({ url, onFaviconLoaded }: ArticleEmbedProps) => {
  const [data, setData] = useState<UnfurlResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Clean the URL before processing
  const cleanedUrl = cleanUrl(url);
  const rendererType = resolveRenderer(cleanedUrl);

  useEffect(() => {
    const unfurlArticle = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('[ArticleEmbed] Unfurling URL:', cleanedUrl);

        const { data: result, error: fetchError } = await supabase.functions.invoke(
          'unfurl-article',
          {
            body: { url: cleanedUrl, bustCache: Date.now() },
          }
        );

        if (fetchError) {
          console.error('[ArticleEmbed] Error:', fetchError);
        }

        let unfurledData = result as UnfurlResult | null;

        // If unfurl failed or returned a poor title (just the domain), enhance with OG data
        const titleLooksLikeDomain = unfurledData?.meta?.title && (
          unfurledData.meta.title === unfurledData.site?.domain ||
          unfurledData.meta.title.length < 5 ||
          !unfurledData.meta.title.trim()
        );

        if (!unfurledData || fetchError || titleLooksLikeDomain) {
          console.log('[ArticleEmbed] Trying fetch-og as fallback');
          try {
            const { data: ogData } = await supabase.functions.invoke('fetch-og', {
              body: { url: cleanedUrl },
            });

            if (ogData) {
              const ogTitle = ogData.meta?.title || ogData.title;
              const ogImage = ogData.meta?.image || ogData.image;
              const ogDescription = ogData.meta?.description || ogData.description;
              
              if (!unfurledData) {
                let domain = cleanedUrl;
                try { domain = new URL(cleanedUrl).hostname; } catch {}
                unfurledData = {
                  kind: 'generic-article',
                  resolvedUrl: cleanedUrl,
                  site: { name: domain.replace('www.', ''), domain, favicon: '' },
                  meta: { title: ogTitle || domain, description: ogDescription || '', image: ogImage || null, publishedTime: null },
                  content: { html: '' },
                };
              } else {
                // Enhance existing data
                if (titleLooksLikeDomain && ogTitle) unfurledData.meta.title = ogTitle;
                if (!unfurledData.meta.image && ogImage) unfurledData.meta.image = ogImage;
                if (!unfurledData.meta.description && ogDescription) unfurledData.meta.description = ogDescription;
              }
            }
          } catch (ogErr) {
            console.warn('[ArticleEmbed] OG fallback also failed:', ogErr);
          }
        }

        if (!unfurledData) {
          setError('Failed to load article');
          return;
        }

        console.log('[ArticleEmbed] Result:', unfurledData);
        setData(unfurledData);
        
        if (unfurledData?.site?.favicon && onFaviconLoaded) {
          onFaviconLoaded(unfurledData.site.favicon);
        }
      } catch (err) {
        console.error('[ArticleEmbed] Exception:', err);
        setError('Failed to load article');
      } finally {
        setIsLoading(false);
      }
    };

    unfurlArticle();
  }, [cleanedUrl]);

  if (isLoading) {
    return (
      <div data-embed-status="loading">
        <div className="rounded-2xl overflow-hidden border border-border">
          <Skeleton className="h-48 w-full" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    // Graceful fallback - just show title and link, no error message
    let fallbackDomain = cleanedUrl;
    try {
      fallbackDomain = new URL(cleanedUrl).hostname;
    } catch {
      // If URL is still invalid, use as-is
    }
    
    return (
      <div data-embed-status="ready">
        <LinkPreviewCard
          url={cleanedUrl}
          title={data?.meta.title || fallbackDomain}
          description=""
          domain={fallbackDomain}
          favicon={data?.site.favicon}
          siteName={data?.site.name}
        />
      </div>
    );
  }

  // Router: One renderer per URL type
  
  // Reddit posts - use official Reddit embed (no fallback card)
  if (rendererType === 'reddit' && data.kind === 'reddit-post') {
    return (
      <RedditEmbed
        url={data.resolvedUrl}
        title={data.meta.title}
        thumbnailUrl={data.meta.image}
        description={data.meta.description}
      />
    );
  }

  // Quora posts - link card only (Quora blocks embeds)
  if (rendererType === 'quora') {
    return (
      <div data-embed-status="ready">
        <LinkPreviewCard
          url={data.resolvedUrl}
          title={data.meta.title || 'View on Quora'}
          description={data.meta.description}
          image={data.meta.image || undefined}
          domain={data.site.domain}
          favicon={data.site.favicon}
          siteName={data.site.name}
        />
      </div>
    );
  }

  // Everything else - rich article card
  return (
    <div data-embed-status="ready">
      <ArticleContentEmbed data={data} />
    </div>
  );
};
