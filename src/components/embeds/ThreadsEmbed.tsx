import { useEffect, useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import threadsIcon from "@/assets/platforms/threads.svg";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ThreadsEmbedProps {
  url: string;
}

interface ThreadsData {
  title?: string;
  description?: string;
  image?: string;
  username?: string;
}

// Extract @username from OG title like "Username (@handle) on Threads"
const extractUsername = (title?: string): string | null => {
  if (!title) return null;
  const match = title.match(/@([a-zA-Z0-9_.]+)/);
  return match ? match[1] : null;
};

// Extract display name from title like "Display Name (@handle) on Threads"
const extractDisplayName = (title?: string): string | null => {
  if (!title) return null;
  const match = title.match(/^(.+?)\s*\(/);
  return match ? match[1].trim() : null;
};

const cache = new Map<string, ThreadsData>();

export const ThreadsEmbed = memo(({ url }: ThreadsEmbedProps) => {
  const [data, setData] = useState<ThreadsData | null>(cache.get(url) || null);
  const [loading, setLoading] = useState(!cache.has(url));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache.has(url)) return;

    const fetchData = async () => {
      try {
        const { data: ogData, error: ogError } = await supabase.functions.invoke('fetch-og', {
          body: { url },
        });
        if (ogError) throw ogError;
        
        const result: ThreadsData = {
          title: ogData?.title,
          description: ogData?.description,
          image: ogData?.image,
          username: extractUsername(ogData?.title),
        };
        cache.set(url, result);
        setData(result);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  if (error) {
    return (
      <Card className="p-6 text-center space-y-3">
        <div className="flex justify-center">
          <img src={threadsIcon} alt="Threads" className="w-10 h-10 dark:invert" />
        </div>
        <p className="text-sm text-muted-foreground">Unable to load this post</p>
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            View on Threads
          </a>
        </Button>
      </Card>
    );
  }

  if (loading) {
    return <div className="rounded-xl bg-muted animate-pulse aspect-[4/3]" />;
  }

  if (!data) return null;

  const username = data.username;
  const displayName = extractDisplayName(data.title);
  // Decode HTML entities in description
  const description = data.description
    ?.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    ?.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec)))
    ?.replace(/&amp;/g, '&');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mx-4"
    >
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {/* Header: avatar area + username + Threads icon */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
            <img src={threadsIcon} alt="Threads" className="w-5 h-5 dark:invert" />
          </div>
          <div className="flex-1 min-w-0">
            {displayName && (
              <span className="font-semibold text-sm block leading-tight truncate">
                {displayName}
              </span>
            )}
            {username && (
              <span className="text-xs text-muted-foreground block leading-tight">
                @{username}
              </span>
            )}
          </div>
          <img src={threadsIcon} alt="Threads" className="w-5 h-5 shrink-0 dark:invert" />
        </div>

        {/* Text content */}
        {description && (
          <div className="px-4 pb-2">
            <p className="text-sm whitespace-pre-line leading-relaxed line-clamp-4">
              {description}
            </p>
          </div>
        )}

        {/* Image */}
        {data.image && (
          <div className="w-full">
            <img
              src={`${SUPABASE_URL}/functions/v1/img-proxy?url=${encodeURIComponent(data.image)}`}
              alt="Thread post"
              className="w-full h-auto object-cover"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
      </div>
    </a>
  );
});

ThreadsEmbed.displayName = 'ThreadsEmbed';
