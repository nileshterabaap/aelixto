import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useCreatePost } from "@/hooks/usePosts";
import { supabase } from "@/integrations/supabase/client";
import { classifyUrl, deriveMediaType } from "@/config/platformRegistry";
import { useSaveDraft, useDeleteDraft, type PostDraft } from "@/hooks/useDrafts";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDraft?: PostDraft | null;
}

export const CreatePostDialog = ({ open, onOpenChange, initialDraft }: CreatePostDialogProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [linkUrl, setLinkUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [showThumbnailInput, setShowThumbnailInput] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [embedHtml, setEmbedHtml] = useState("");
  const [ogType, setOgType] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const createPost = useCreatePost();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();

  // Hydrate from existing draft when opening
  useEffect(() => {
    if (open && initialDraft) {
      setStep(2);
      setLinkUrl(initialDraft.link_url || "");
      setThumbnailUrl(initialDraft.thumbnail_url || "");
      setTitle(initialDraft.title || "");
      setCaption(initialDraft.caption || "");
      setEmbedHtml(initialDraft.embed_html || "");
      setOgType(initialDraft.og_type || null);
      setDraftId(initialDraft.id);
    }
  }, [open, initialDraft]);

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
        console.log('[CreatePostDialog] Fetching Reddit thumbnail via edge function');
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
            if (ogData.og_type) setOgType(ogData.og_type);
          }
        } catch (error) {
          console.error('[CreatePostDialog] Reddit fetch failed:', error);
        }
      } else if (linkUrl.includes("instagram.com") || linkUrl.includes("facebook.com") || linkUrl.includes("fb.watch") || linkUrl.includes("fb.me")) {
        const platform = linkUrl.includes("instagram.com") ? "instagram" : "facebook";
        try {
          const { data, error } = await supabase.functions.invoke('fetch-meta-thumbnail', {
            body: { url: linkUrl, platform }
          });
          if (!error && data) {
            videoTitle = data.title || "";
            thumbnail = data.thumbnail || "";
          }
        } catch (error) {
          console.error(`[CreatePostDialog] ${platform} thumbnail fetch failed:`, error);
        }
      } else if (linkUrl.includes("pinterest.com") || linkUrl.includes("pin.it")) {
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
            if (ogData.og_type) setOgType(ogData.og_type);
          }
        } catch (error) {
          console.error('[CreatePostDialog] Pinterest OG fetch failed:', error);
        }
      } else if (linkUrl.includes("spotify.com") || linkUrl.includes("open.spotify.com")) {
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
          }
        } catch (error) {
          console.error('[CreatePostDialog] Spotify OG fetch failed:', error);
        }
      } else if (linkUrl.includes("twitter.com") || linkUrl.includes("x.com")) {
        try {
          const { data: ogData, error } = await supabase.functions.invoke('fetch-og', {
            body: { url: linkUrl }
          });
          if (!error && ogData) {
            videoTitle = ogData.title || "";
            thumbnail = ogData.image || "";
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
            if (ogData.og_type) setOgType(ogData.og_type);
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

      setThumbnailUrl(thumbnail);
      setTitle(videoTitle);
      setStep(2);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handlePost = () => {
    if (!linkUrl.trim()) return;

    // Use centralised classification
    const platform = classifyUrl(linkUrl, ogType);
    const mediaType = deriveMediaType(linkUrl, platform);

    // Validate Facebook embed HTML before saving
    if (platform === 'facebook' && embedHtml) {
      const hasIframe = /<iframe\b/i.test(embedHtml);
      const hasValidBlockquote = /<blockquote\b[^>]*(data-href|cite)="[^"]+"/i.test(embedHtml);
      const hasSdkDiv = /<div\b[^>]*class="fb-(post|video)"[^>]*data-href="[^"]+"/i.test(embedHtml);
      if (!hasIframe && !hasValidBlockquote && !hasSdkDiv) {
        toast.error("This Facebook post could not be embedded. Try sharing a different post.");
        return;
      }
    }

    console.log('[CreatePostDialog] Creating post with data:', {
      title: title.trim(),
      content: caption.trim(),
      media_type: mediaType,
      media_url: linkUrl,
      platform,
      thumbnail_url: thumbnailUrl,
      embed_html: embedHtml ? `${embedHtml.length} chars` : 'none',
    });

    createPost.mutate({
      title: title.trim() || undefined,
      content: caption.trim() || "",
      media_type: mediaType,
      media_url: linkUrl,
      platform: platform,
      thumbnail_url: thumbnailUrl || undefined,
      embed_html: embedHtml || undefined,
    });

    // If posted from a draft, remove it
    if (draftId) {
      deleteDraft.mutate(draftId);
    }

    resetAndClose();
  };

  const handleSaveAsDraft = async () => {
    if (!linkUrl.trim()) {
      toast.error("Add a link before saving as draft");
      return;
    }
    const platform = classifyUrl(linkUrl, ogType);
    const mediaType = deriveMediaType(linkUrl, platform);
    await saveDraft.mutateAsync({
      link_url: linkUrl,
      caption: caption.trim() || null,
      title: title.trim() || null,
      thumbnail_url: thumbnailUrl || null,
      embed_html: embedHtml || null,
      platform,
      media_type: mediaType,
      og_type: ogType,
    });
    // If editing an existing draft, delete the old one (replace)
    if (draftId) {
      deleteDraft.mutate(draftId);
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep(1);
    setLinkUrl("");
    setThumbnailUrl("");
    setTitle("");
    setCaption("");
    setShowThumbnailInput(false);
    setEmbedHtml("");
    setOgType(null);
    setDraftId(null);
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
    setIsLoadingPreview(false);
    setEmbedHtml("");
    setOgType(null);
    setDraftId(null);
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
            <Button
              onClick={handleSaveAsDraft}
              variant="outline"
              className="w-full"
              disabled={saveDraft.isPending}
            >
              {saveDraft.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                "Save as Draft"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
