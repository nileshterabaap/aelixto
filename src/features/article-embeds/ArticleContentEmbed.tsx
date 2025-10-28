import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArticleContentEmbedProps {
  data: {
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
  };
}

export const ArticleContentEmbed = ({ data }: ArticleContentEmbedProps) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  // Use description if no HTML content
  const excerpt = data.meta.description || '';

  return (
    <article className="rounded-2xl overflow-hidden border border-border bg-card hover:shadow-lg transition-all">
      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Title */}
        <h3 className="text-xl font-bold leading-tight text-foreground">
          {data.meta.title}
        </h3>

        {/* Thumbnail */}
        {data.meta.image && (
          <div className="relative w-full h-48 rounded-xl overflow-hidden bg-muted">
            <img
              src={data.meta.image}
              alt={data.meta.title}
              className="w-full h-full object-cover"
              loading="lazy"
              width="400"
              height="192"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Excerpt (2-3 sentences, ~200-260 chars) */}
        {excerpt && (
          <p className="text-muted-foreground leading-relaxed line-clamp-3">
            {excerpt}
          </p>
        )}

        {/* Site Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {data.site.favicon && (
            <img
              src={data.site.favicon}
              alt=""
              className="w-4 h-4 rounded"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <span className="font-medium">{data.site.name}</span>
          {data.meta.publishedTime && (
            <>
              <span>•</span>
              <time dateTime={data.meta.publishedTime}>
                {formatDate(data.meta.publishedTime)}
              </time>
            </>
          )}
        </div>

        {/* Read More Button */}
        <div className="pt-2">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            asChild
          >
            <a
              href={data.resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Read on {data.site.name}
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
};
