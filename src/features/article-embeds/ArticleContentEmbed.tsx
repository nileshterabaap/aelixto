import { ExternalLink, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(data.resolvedUrl);
    toast({
      title: "Link copied",
      description: "The article link has been copied to your clipboard",
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.meta.title,
          url: data.resolvedUrl,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      handleCopyLink();
    }
  };

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

  return (
    <article className="rounded-2xl overflow-hidden border-2 border-border bg-card">
      {/* Hero Image */}
      {data.meta.image && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={data.meta.image}
            alt={data.meta.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Article Header */}
      <div className="p-5 space-y-3">
        {/* Site Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {data.site.favicon && (
            <img
              src={data.site.favicon}
              alt=""
              className="w-4 h-4 rounded"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span className="font-medium">{data.site.name}</span>
          {data.meta.publishedTime && (
            <>
              <span>•</span>
              <span>{formatDate(data.meta.publishedTime)}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold leading-tight">{data.meta.title}</h2>

        {/* Description */}
        {data.meta.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {data.meta.description}
          </p>
        )}

        {/* Article Content */}
        {data.content.html && (
          <div className="relative">
            <div
              className={`prose prose-sm dark:prose-invert max-w-none ${
                !isExpanded ? 'line-clamp-[12] max-h-[450px] overflow-hidden' : ''
              }`}
              dangerouslySetInnerHTML={{ __html: data.content.html }}
            />
            {!isExpanded && data.content.html.length > 1000 && (
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
            )}
          </div>
        )}

        {/* Expand/Collapse Button */}
        {data.content.html && data.content.html.length > 1000 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </Button>
        )}
      </div>

      {/* Action Bar */}
      <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-2"
          asChild
        >
          <a href={data.resolvedUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Read full on {data.site.name}
          </a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleCopyLink}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleShare}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
};
