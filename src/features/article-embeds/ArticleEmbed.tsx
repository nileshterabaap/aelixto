import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { RedditPostEmbed } from "./RedditPostEmbed";
import { ArticleContentEmbed } from "./ArticleContentEmbed";
import { LinkPreviewCard } from "./LinkPreviewCard";

interface ArticleEmbedProps {
  url: string;
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

export const ArticleEmbed = ({ url }: ArticleEmbedProps) => {
  const [data, setData] = useState<UnfurlResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unfurlArticle = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('[ArticleEmbed] Unfurling URL:', url);

        const { data: result, error: fetchError } = await supabase.functions.invoke(
          'unfurl-article',
          {
            body: { url },
          }
        );

        if (fetchError) {
          console.error('[ArticleEmbed] Error:', fetchError);
          setError('Failed to load article');
          return;
        }

        console.log('[ArticleEmbed] Result:', result);
        setData(result as UnfurlResult);
      } catch (err) {
        console.error('[ArticleEmbed] Exception:', err);
        setError('Failed to load article');
      } finally {
        setIsLoading(false);
      }
    };

    unfurlArticle();
  }, [url]);

  if (isLoading) {
    return (
      <div className="rounded-2xl overflow-hidden border-2 border-border">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <LinkPreviewCard
        url={url}
        title="Unable to load content"
        description={error || "This link couldn't be previewed"}
        domain={new URL(url).hostname}
      />
    );
  }

  // Quora posts - show link card only (Quora blocks embeds)
  if (data.kind === 'quora-post') {
    return (
      <LinkPreviewCard
        url={data.resolvedUrl}
        title={data.meta.title}
        description={data.meta.description}
        image={data.meta.image || undefined}
        domain={data.site.domain}
        favicon={data.site.favicon}
        siteName={data.site.name}
      />
    );
  }

  // Reddit posts - use official Reddit embed
  if (data.kind === 'reddit-post') {
    return <RedditPostEmbed url={data.resolvedUrl} data={data} />;
  }

  // Medium and generic articles - rich content card
  if (data.kind === 'medium-article' || data.kind === 'generic-article') {
    return <ArticleContentEmbed data={data} />;
  }

  // Fallback
  return (
    <LinkPreviewCard
      url={data.resolvedUrl}
      title={data.meta.title}
      description={data.meta.description}
      image={data.meta.image || undefined}
      domain={data.site.domain}
      favicon={data.site.favicon}
      siteName={data.site.name}
    />
  );
};
