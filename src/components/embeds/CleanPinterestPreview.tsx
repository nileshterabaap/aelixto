import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import pinterestIcon from "@/assets/pinterest-icon.png";
import { supabase } from "@/integrations/supabase/client";

interface CleanPinterestPreviewProps {
  url: string;
}

interface PinData {
  finalUrl: string;
  title: string;
  imageUrl: string | null;
}

export const CleanPinterestPreview = ({ url }: CleanPinterestPreviewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [pinData, setPinData] = useState<PinData | null>(null);

  useEffect(() => {
    const loadPinData = async () => {
      console.log("[CleanPinterestPreview] Loading Pinterest data for URL:", url);
      setIsLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke('pin-preview', {
          body: { url }
        });

        if (error) throw error;

        if (data) {
          setPinData({
            finalUrl: data.finalUrl || url,
            title: data.title || 'Pinterest Pin',
            imageUrl: data.imageUrl
          });
          console.log("[CleanPinterestPreview] Loaded pin data:", data);
        }
      } catch (error) {
        console.warn("[CleanPinterestPreview] Failed to fetch pin data:", error);
        setPinData({
          finalUrl: url,
          title: 'Pinterest Pin',
          imageUrl: null
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPinData();
  }, [url]);

  const handleOpen = () => {
    if (pinData?.finalUrl) {
      window.open(pinData.finalUrl, '_blank');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="w-full max-w-[500px] mx-auto overflow-hidden">
        <Skeleton className="w-full aspect-[4/5]" />
        <div className="p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Card>
    );
  }

  if (!pinData) {
    return (
      <Card className="w-full max-w-[500px] mx-auto p-6 flex flex-col items-center gap-4">
        <img src={pinterestIcon} alt="Pinterest" className="w-12 h-12" />
        <p className="text-sm text-muted-foreground text-center">
          Unable to load Pinterest preview
        </p>
        <Button variant="outline" onClick={handleOpen}>
          View on Pinterest
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[500px] mx-auto overflow-hidden">
      <div 
        className="rounded-2xl overflow-hidden bg-muted aspect-[4/5] cursor-pointer"
        onClick={handleOpen}
      >
        {pinData.imageUrl ? (
          <img 
            src={pinData.imageUrl} 
            alt={pinData.title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img src={pinterestIcon} alt="Pinterest" className="w-16 h-16 opacity-50" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <img src={pinterestIcon} alt="Pinterest" className="w-4 h-4" />
          <span className="text-sm font-medium line-clamp-1">{pinData.title}</span>
        </div>
        <Button 
          variant="secondary" 
          size="sm"
          className="w-full"
          onClick={handleOpen}
        >
          View on Pinterest
        </Button>
      </div>
    </Card>
  );
};
