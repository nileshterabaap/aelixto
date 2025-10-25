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
  const [embedHtml, setEmbedHtml] = useState("");
  const [showThumbnailInput, setShowThumbnailInput] = useState(false);
  const createPost = useCreatePost();

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) return;
    
    // Auto-generate thumbnail URL and fetch title based on platform
    let thumbnail = "";
    let videoTitle = "";
    
    if (linkUrl.includes("youtube.com") || linkUrl.includes("youtu.be")) {
      // Extract video ID from various YouTube URL formats including shorts
      const videoId = linkUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
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
      thumbnail = linkUrl + "media/?size=l";
    }
    
    setThumbnailUrl(thumbnail);
    setTitle(videoTitle);
    setStep(2);
  };

  const handlePost = () => {
    if (!linkUrl.trim() && !embedHtml.trim()) return;

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
    } else if (linkUrl.includes("twitter.com") || linkUrl.includes("x.com")) {
      platform = "twitter";
      mediaType = "video"; // Twitter embeds handle both images and videos
    } else if (linkUrl.includes("pinterest.com") || linkUrl.includes("pin.it")) {
      platform = "pinterest";
      mediaType = "image";
    }

    createPost.mutate({
      title: title.trim() || undefined,
      content: caption.trim() || "",
      media_type: mediaType,
      media_url: linkUrl || undefined,
      platform: platform || undefined,
      embed_html: embedHtml.trim() || undefined,
    });

    // Reset form
    setStep(1);
    setLinkUrl("");
    setThumbnailUrl("");
    setTitle("");
    setCaption("");
    setEmbedHtml("");
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
    setEmbedHtml("");
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

            <div>
              <Label htmlFor="embedHtml">Or paste embed HTML (Instagram/Facebook)</Label>
              <Textarea
                id="embedHtml"
                placeholder='<blockquote class="instagram-media"...'
                value={embedHtml}
                onChange={(e) => setEmbedHtml(e.target.value)}
                className="mt-1.5 min-h-[100px] resize-none font-mono text-xs"
              />
            </div>

            <Button onClick={handleLinkSubmit} className="w-full" disabled={!linkUrl.trim() && !embedHtml.trim()}>
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
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                type="text"
                placeholder="Post title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>

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
