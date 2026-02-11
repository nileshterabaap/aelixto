import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCreatePost } from "@/hooks/usePosts";
import { supabase } from "@/integrations/supabase/client";

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
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [embedHtml, setEmbedHtml] = useState("");
  const createPost = useCreatePost();

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) return;
    
    setIsLoadingPreview(true);
    
    // Auto-generate thumbnail URL and fetch title based on platform
    let thumbnail = "";
    let videoTitle = "";
    
    console.log('[CreatePostDialog] Processing URL:', linkUrl);
    
    try {
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
      } else if (linkUrl.includes("reddit.com") || linkUrl.includes("redd.it")) {
        // Reddit - use server-side edge function to avoid CORS
        console.log('[CreatePostDialog] Fetching Reddit thumbnail via edge function');
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
            console.log('[CreatePostDialog] Got Reddit thumbnail:', thumbnail?.substring(0, 60));
          }
        } catch (error) {
          console.error('[CreatePostDialog] Reddit fetch failed:', error);
        }
      } else if (linkUrl.includes("instagram.com") || linkUrl.includes("facebook.com") || linkUrl.includes("fb.watch") || linkUrl.includes("fb.me")) {
        // Instagram/Facebook - use server-side Meta API for reliable thumbnails
        const platform = linkUrl.includes("instagram.com") ? "instagram" : "facebook";
        try {
          console.log(`[CreatePostDialog] Fetching ${platform} thumbnail via edge function`);
          const { data, error } = await supabase.functions.invoke('fetch-meta-thumbnail', {
            body: { url: linkUrl, platform }
          });
          if (!error && data) {
            videoTitle = data.title || "";
            thumbnail = data.thumbnail || "";
            console.log(`[CreatePostDialog] Got ${platform} thumbnail:`, thumbnail?.substring(0, 60));
          }
        } catch (error) {
          console.error(`[CreatePostDialog] ${platform} thumbnail fetch failed:`, error);
        }
      } else if (linkUrl.includes("pinterest.com") || linkUrl.includes("pin.it")) {
        // Pinterest - fetch OG data for thumbnail
        console.log('[CreatePostDialog] Fetching Pinterest thumbnail via OG');
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
            console.log('[CreatePostDialog] Got Pinterest thumbnail:', thumbnail?.substring(0, 60));
          }
        } catch (error) {
          console.error('[CreatePostDialog] Pinterest OG fetch failed:', error);
        }
      } else if (linkUrl.includes("spotify.com") || linkUrl.includes("open.spotify.com")) {
        // Spotify - fetch OG data for thumbnail
        console.log('[CreatePostDialog] Fetching Spotify thumbnail via OG');
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
            console.log('[CreatePostDialog] Got Spotify thumbnail:', thumbnail?.substring(0, 60));
          }
        } catch (error) {
          console.error('[CreatePostDialog] Spotify OG fetch failed:', error);
        }
      } else if (linkUrl.includes("twitter.com") || linkUrl.includes("x.com")) {
        // Twitter/X - try OG data (Twitter oEmbed doesn't provide images)
        console.log('[CreatePostDialog] Fetching Twitter thumbnail via OG');
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
            console.log('[CreatePostDialog] Got Twitter thumbnail:', thumbnail?.substring(0, 60));
          }
        } catch (error) {
          console.error('[CreatePostDialog] Twitter OG fetch failed:', error);
        }
      }
      
      // If no thumbnail yet, fetch OG data for all platforms
      if (!thumbnail) {
        console.log('[CreatePostDialog] Fetching OG data for:', linkUrl);
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });

          if (!error && ogData) {
            console.log('[CreatePostDialog] OG data received:', ogData);
            if (!videoTitle && ogData.title) videoTitle = ogData.title;
            if (ogData.image) thumbnail = ogData.image;
          } else {
            console.error('[CreatePostDialog] OG fetch error:', error);
          }
        } catch (error) {
          console.error('[CreatePostDialog] Failed to fetch OG data:', error);
        }
      }
      
      // Fetch oEmbed HTML in parallel for instant embed rendering
      console.log('[CreatePostDialog] Fetching oEmbed HTML...');
      try {
        const { data: oembedData, error: oembedError } = await supabase.functions.invoke('fetch-oembed', {
          body: { url: linkUrl }
        });
        if (!oembedError && oembedData?.embed_html) {
          setEmbedHtml(oembedData.embed_html);
          console.log('[CreatePostDialog] Got oEmbed HTML, length:', oembedData.embed_html.length);
        }
      } catch (error) {
        console.error('[CreatePostDialog] oEmbed fetch failed:', error);
      }

      console.log('[CreatePostDialog] Setting thumbnail:', thumbnail);
      console.log('[CreatePostDialog] Setting title:', videoTitle);
      setThumbnailUrl(thumbnail);
      setTitle(videoTitle);
      setStep(2);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handlePost = () => {
    if (!linkUrl.trim()) return;

    // Detect platform and media type
    let platform = "";
    let mediaType = "none"; // Default to "none" for articles/blogs
    
    if (linkUrl.includes("youtube.com") || linkUrl.includes("youtu.be")) {
      platform = "youtube";
      mediaType = "video";
    } else if (linkUrl.includes("tiktok.com")) {
      platform = "tiktok";
      mediaType = "video";
    } else if (linkUrl.includes("instagram.com")) {
      platform = "instagram";
      mediaType = "image";
      if (linkUrl.includes("/reel/") || linkUrl.includes("/reels/")) {
        mediaType = "video";
      }
    } else if (linkUrl.includes("reddit.com")) {
      platform = "reddit";
      mediaType = "none";
    } else if (linkUrl.includes("twitter.com") || linkUrl.includes("x.com")) {
      platform = "twitter";
      mediaType = "video";
    } else if (linkUrl.includes("pinterest.com") || linkUrl.includes("pin.it")) {
      platform = "pinterest";
      mediaType = "image";
    } else if (linkUrl.includes("medium.com")) {
      platform = "medium";
      mediaType = "none";
    } else if (linkUrl.includes("quora.com")) {
      platform = "quora";
      mediaType = "none";
    } else if (linkUrl.includes("facebook.com") || linkUrl.includes("fb.watch") || linkUrl.includes("fb.me")) {
      platform = "facebook";
      mediaType = "none";
    } else if (linkUrl.includes("spotify.com") || linkUrl.includes("open.spotify.com")) {
      platform = "spotify";
      mediaType = "none";
    }

    console.log('[CreatePostDialog] Creating post with data:', {
      title: title.trim(),
      content: caption.trim(),
      media_type: mediaType,
      media_url: linkUrl,
      platform: platform,
      thumbnail_url: thumbnailUrl,
      embed_html: embedHtml ? `${embedHtml.length} chars` : 'none',
    });

    createPost.mutate({
      title: title.trim() || undefined,
      content: caption.trim() || "",
      media_type: mediaType,
      media_url: linkUrl,
      platform: platform || undefined,
      thumbnail_url: thumbnailUrl || undefined,
      embed_html: embedHtml || undefined,
    });

    // Reset form
    setStep(1);
    setLinkUrl("");
    setThumbnailUrl("");
    setTitle("");
    setCaption("");
    setShowThumbnailInput(false);
    setEmbedHtml("");
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
    setStep(1);
    setLinkUrl("");
    setThumbnailUrl("");
    setTitle("");
    setCaption("");
    setShowThumbnailInput(false);
    setIsLoadingPreview(false);
    setEmbedHtml("");
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
              {step === 1 ? "Create Post" : "Add Details"}
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
                placeholder="https://youtube.com/... or blog URL..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <Button 
              onClick={handleLinkSubmit} 
              className="w-full" 
              disabled={!linkUrl.trim() || isLoadingPreview}
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching preview...
                </>
              ) : (
                "Next"
              )}
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
