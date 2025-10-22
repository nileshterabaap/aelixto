import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useCreatePost } from "@/hooks/usePosts";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePostDialog = ({ open, onOpenChange }: CreatePostDialogProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [linkUrl, setLinkUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [showThumbnailInput, setShowThumbnailInput] = useState(false);
  const createPost = useCreatePost();

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) return;
    
    // Auto-generate thumbnail URL and fetch title based on platform
    let thumbnail = "";
    let videoTitle = "";
    
    if (linkUrl.includes("youtube.com") || linkUrl.includes("youtu.be")) {
      const videoId = linkUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      if (videoId) {
        thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        
        // Fetch video title from YouTube oEmbed API
        try {
          const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
          if (response.ok) {
            const data = await response.json();
            videoTitle = data.title || "";
          }
        } catch (error) {
          console.error("Failed to fetch video title:", error);
        }
      }
    } else if (linkUrl.includes("instagram.com")) {
      // Simple clickable embed for Instagram - no oEmbed needed for now
      videoTitle = "Instagram Post";
    }
    
    setThumbnailUrl(thumbnail);
    setTitle(videoTitle);
    setStep(2);
  };

  const handlePost = () => {
    if (!linkUrl.trim()) return;

    // Detect platform and media type
    let platform = "";
    let mediaType = "image";
    
    if (linkUrl.includes("youtube.com") || linkUrl.includes("youtu.be")) {
      platform = "youtube";
      mediaType = "video";
    } else if (linkUrl.includes("tiktok.com")) {
      platform = "tiktok";
      mediaType = "video";
    } else if (linkUrl.includes("instagram.com")) {
      platform = "instagram";
      if (linkUrl.includes("/reel/") || linkUrl.includes("/reels/")) {
        mediaType = "video";
      }
    } else if (linkUrl.includes("reddit.com")) {
      platform = "reddit";
    }

    createPost.mutate({
      title: title.trim() || undefined,
      content: caption.trim() || linkUrl,
      media_type: mediaType,
      media_url: thumbnailUrl || linkUrl,
      platform: platform || undefined,
    });

    // Reset form
    setStep(1);
    setLinkUrl("");
    setThumbnailUrl("");
    setTitle("");
    setCaption("");
    setShowThumbnailInput(false);
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep(1);
    setShowThumbnailInput(false);
  };

  const handleClose = () => {
    setStep(1);
    setLinkUrl("");
    setThumbnailUrl("");
    setTitle("");
    setCaption("");
    setShowThumbnailInput(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 1 ? "Insert Link" : "Add Details"}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="link">Paste your link</Label>
              <Input
                id="link"
                type="url"
                placeholder="https://youtube.com/... or https://instagram.com/..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <Button onClick={handleLinkSubmit} className="w-full" disabled={!linkUrl.trim()}>
              Next
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {thumbnailUrl && (
              <div className="rounded-lg overflow-hidden border">
                <img 
                  src={thumbnailUrl} 
                  alt="Preview" 
                  className="w-full h-48 object-cover"
                  onError={() => setThumbnailUrl("")}
                />
              </div>
            )}

            <div>
              <Label htmlFor="caption">Caption (optional)</Label>
              <Textarea
                id="caption"
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="mt-1.5 min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowThumbnailInput(!showThumbnailInput)}
                className="w-full"
              >
                {showThumbnailInput ? "Hide" : "Change"} Thumbnail
              </Button>

              {showThumbnailInput && (
                <div>
                  <Label htmlFor="thumbnail">Thumbnail URL</Label>
                  <Input
                    id="thumbnail"
                    type="url"
                    placeholder="https://..."
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>

            <Button onClick={handlePost} className="w-full">
              Post
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
