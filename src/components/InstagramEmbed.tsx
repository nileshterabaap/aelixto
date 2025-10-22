import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import instagramIcon from "@/assets/instagram-icon.png";
import { loadInstagramEmbedScript, processInstagramEmbeds, extractInstagramPostId } from "@/lib/instagramEmbed";

interface InstagramEmbedProps {
  url: string;
}

export const InstagramEmbed = ({ url }: InstagramEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedError, setEmbedError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initEmbed = async () => {
      try {
        // Load Instagram script
        await loadInstagramEmbedScript();
        
        if (!mounted) return;

        // Process embeds after a short delay to ensure DOM is ready
        setTimeout(() => {
          if (mounted) {
            processInstagramEmbeds();
            // Set loading to false after processing
            setTimeout(() => {
              if (mounted) setIsLoading(false);
            }, 1000);
          }
        }, 100);
      } catch (error) {
        console.error("Failed to load Instagram embed:", error);
        if (mounted) {
          setEmbedError(true);
          setIsLoading(false);
        }
      }
    };

    initEmbed();

    return () => {
      mounted = false;
    };
  }, [url]);

  // Fallback card if embedding fails
  if (embedError) {
    return (
      <Card className="overflow-hidden border rounded-2xl">
        <div className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <img src={instagramIcon} alt="Instagram" className="w-12 h-12" />
          </div>
          <p className="text-sm text-muted-foreground">
            Unable to load Instagram post
          </p>
          <Button asChild variant="outline" className="w-full">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View on Instagram
            </a>
          </Button>
        </div>
      </Card>
    );
  }

  const postId = extractInstagramPostId(url);
  if (!postId) {
    return (
      <Card className="overflow-hidden border rounded-2xl">
        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Invalid Instagram URL</p>
          <Button asChild variant="outline" className="w-full">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open Link
            </a>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="instagram-embed-container">
      {isLoading && (
        <div className="rounded-2xl overflow-hidden mb-2 bg-muted animate-pulse" style={{ height: '500px' }} />
      )}
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ 
          maxWidth: '540px',
          minWidth: '326px',
          width: 'calc(100% - 2px)',
          visibility: isLoading ? 'hidden' : 'visible',
          height: isLoading ? '0' : 'auto'
        }}
      />
    </div>
  );
};
