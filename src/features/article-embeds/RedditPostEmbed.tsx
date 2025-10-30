import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { MessageCircle, ArrowUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RedditPostEmbedProps {
  url: string;
  data: {
    meta: {
      title: string;
    };
  };
}

interface RedditPostData {
  title: string;
  author: string;
  subreddit: string;
  selftext: string;
  selftext_html: string | null;
  thumbnail: string | null;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
}

export const RedditPostEmbed = ({ url, data }: RedditPostEmbedProps) => {
  const [postData, setPostData] = useState<RedditPostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchRedditPost = async () => {
      try {
        setIsLoading(true);
        setError(false);
        
        console.log('[RedditEmbed] Fetching post data for:', url);
        
        const { data: responseData, error: functionError } = await supabase.functions.invoke(
          'fetch-reddit-post',
          {
            body: { url }
          }
        );

        if (functionError) {
          throw functionError;
        }

        if (responseData.error) {
          throw new Error(responseData.error);
        }

        console.log('[RedditEmbed] Successfully fetched post data');
        setPostData(responseData);
      } catch (error) {
        console.error('[RedditEmbed] Error fetching Reddit post:', error);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRedditPost();
  }, [url]);

  const formatScore = (score: number) => {
    if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}k`;
    }
    return score.toString();
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl overflow-hidden border-2 border-border bg-card">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !postData) {
    return (
      <div className="rounded-2xl overflow-hidden border-2 border-border bg-card p-4">
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {data.meta.title || 'View post on Reddit'}
        </a>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden border-2 border-border bg-card">
      <div className="p-4">
        {/* Subreddit header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#FF4500] flex items-center justify-center">
            <span className="text-white font-bold text-sm">r/</span>
          </div>
          <div>
            <p className="font-semibold text-sm">{postData.subreddit}</p>
            <p className="text-xs text-muted-foreground">
              u/{postData.author} · {formatTime(postData.created_utc)}
            </p>
          </div>
        </div>

        {/* Post title */}
        <h3 className="font-bold text-base mb-2 line-clamp-3">
          {postData.title}
        </h3>

        {/* Post content */}
        {postData.selftext && (
          <p className="text-sm text-foreground/80 line-clamp-4 mb-3">
            {postData.selftext}
          </p>
        )}

        {/* Thumbnail if available */}
        {postData.thumbnail && postData.thumbnail.startsWith('http') && (
          <div className="rounded-lg overflow-hidden mb-3 bg-muted">
            <img 
              src={postData.thumbnail} 
              alt="Post thumbnail"
              className="w-full h-auto object-cover aspect-video"
            />
          </div>
        )}

        {/* Read more button */}
        <button className="w-full text-sm text-primary font-medium mb-3 text-left">
          Read more ↓
        </button>

        {/* Engagement stats */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            <ArrowUp className="w-5 h-5 text-[#FF4500]" />
            <span className="font-semibold text-sm">{formatScore(postData.score)} upvotes</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{postData.num_comments}</span>
          </div>
        </div>

        {/* View comments button */}
        <button className="w-full py-3 rounded-full border-2 border-border hover:bg-muted/50 transition-colors mb-3">
          <span className="text-[#FF4500] font-semibold text-sm">
            View {postData.num_comments} comments
          </span>
        </button>

        {/* View on Reddit link */}
        <a
          href={postData.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="text-sm font-medium">View on Reddit</span>
        </a>
      </div>
    </Card>
  );
};
