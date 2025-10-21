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
  const [caption, setCaption] = useState("");
  const [showThumbnailInput, setShowThumbnailInput] = useState(false);
  const createPost = useCreatePost();

  const handleLinkSubmit = () => {
    if (!linkUrl.trim()) return;
    
    // Auto-generate thumbnail URL based on platform
    let thumbnail = "";
    if (linkUrl.includes("youtube.com") || linkUrl.includes("youtu.be")) {
      const videoId = linkUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      if (videoId) thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    } else if (linkUrl.includes("instagram.com")) {
      thumbnail = linkUrl + "media/?size=l";
    }
    
    setThumbnailUrl(thumbnail);
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
      content: linkUrl,
      media_type: mediaType,
      media_url: thumbnailUrl || linkUrl,
      platform: platform || undefined,
    });

    // Reset form
    setStep(1);
    setLinkUrl("");
    setThumbnailUrl("");
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
