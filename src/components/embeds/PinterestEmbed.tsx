import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadScript, getPinterestPinId } from "@/lib/embedUtils";

interface PinterestEmbedProps {
  url: string;
}

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pinId = getPinterestPinId(url);

  useEffect(() => {
    const embedPin = async () => {
      try {
        await loadScript('https://assets.pinterest.com/js/pinit.js', 'pinterest-embed-script');
        setLoading(false);
      } catch (err) {
        console.error('Failed to load Pinterest embed:', err);
        setError(true);
        setLoading(false);
      }
    };

    embedPin();
  }, [url]);

  if (error || !pinId) {
    return (
      <Card className="p-6 flex flex-col items-center gap-3 border-2">
        <ExternalLink className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="font-semibold mb-1">Pinterest Pin</p>
          <p className="text-sm text-muted-foreground mb-3">View this pin on Pinterest</p>
        </div>
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            View on Pinterest
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex justify-center">
      {loading && (
        <div className="animate-pulse bg-muted rounded-2xl h-96 w-64" />
      )}
      <a
        data-pin-do="embedPin"
        data-pin-width="medium"
        href={url}
      />
    </div>
  );
};