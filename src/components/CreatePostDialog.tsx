import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Plus, X, Check } from "lucide-react";
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
  const [submitState, setSubmitState] = useState<null | "post" | "draft">(null);
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

    setSubmitState("post");
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

    // Let the success animation play before closing
    window.setTimeout(() => resetAndClose(), 650);
  };

  const handleSaveAsDraft = async () => {
    if (!linkUrl.trim()) {
      toast.error("Add a link before saving as draft");
      return;
    }
    const platform = classifyUrl(linkUrl, ogType);
    const mediaType = deriveMediaType(linkUrl, platform);
    setSubmitState("draft");
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
    window.setTimeout(() => resetAndClose(), 650);
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
    setSubmitState(null);
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
    setSubmitState(null);
    onOpenChange(false);
  };

  const stepVariants = {
    initial: (dir: number) => ({ opacity: 0, x: dir * 24, filter: "blur(6px)" }),
    animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (dir: number) => ({ opacity: 0, x: -dir * 24, filter: "blur(6px)" }),
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Blurred backdrop */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              />
            </DialogPrimitive.Overlay>

            {/* Card emerging from the FAB position */}
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none"
                initial={{ opacity: 0, scale: 0.2, y: 220, borderRadius: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0, borderRadius: 28 }}
                exit={{ opacity: 0, scale: 0.25, y: 220, borderRadius: 24 }}
                transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
                style={{ transformOrigin: "50% calc(100% + 60vh)" }}
              >
                <div className="relative overflow-hidden rounded-[28px] bg-background shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
                  {/* Soft gradient sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-transparent dark:from-white/5" />

                  {/* Header */}
                  <div className="relative flex items-center justify-between px-5 pt-5 pb-2">
                    <div className="flex items-center gap-2">
                      <AnimatePresence initial={false} mode="wait">
                        {step === 2 && (
                          <motion.button
                            key="back"
                            onClick={handleBack}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted active:scale-90 transition-transform"
                            aria-label="Back"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </motion.button>
                        )}
                      </AnimatePresence>
                      <DialogPrimitive.Title asChild>
                        <motion.h2
                          key={step}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className="text-lg font-semibold tracking-tight"
                        >
                          {step === 1 ? "Create Post" : "Add Details"}
                        </motion.h2>
                      </DialogPrimitive.Title>
                    </div>
                    <DialogPrimitive.Close
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted active:scale-90 transition-transform"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </DialogPrimitive.Close>
                  </div>

                  {/* Body */}
                  <div className="relative px-5 pb-5 pt-2">
                    <AnimatePresence mode="wait" custom={step === 1 ? -1 : 1} initial={false}>
                      {step === 1 ? (
                        <motion.div
                          key="step1"
                          custom={-1}
                          variants={stepVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          className="space-y-4"
                        >
                          <div>
                            <Label htmlFor="link" className="text-sm font-medium">
                              Paste your link
                            </Label>
                            <Input
                              id="link"
                              type="url"
                              autoFocus
                              placeholder=" "
                              value={linkUrl}
                              onChange={(e) => setLinkUrl(e.target.value)}
                              className="mt-2 h-12 rounded-2xl border-border/70 bg-muted/40 px-4 focus-visible:ring-2 focus-visible:ring-foreground/20"
                            />
                          </div>

                          <Button
                            onClick={handleLinkSubmit}
                            className="h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] transition-transform"
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
                        </motion.div>
                      ) : (
                        <motion.div
                          key="step2"
                          custom={1}
                          variants={stepVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                          className="space-y-4"
                        >
                          {thumbnailUrl && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden rounded-2xl border border-border/60"
                            >
                              <img
                                src={thumbnailUrl}
                                alt="Preview"
                                className="h-48 w-full object-cover"
                                onError={() => setThumbnailUrl("")}
                              />
                            </motion.div>
                          )}

                          <div>
                            <Label htmlFor="caption" className="text-sm font-medium">
                              Caption (optional)
                            </Label>
                            <Textarea
                              id="caption"
                              placeholder="Write a caption..."
                              value={caption}
                              onChange={(e) => setCaption(e.target.value)}
                              className="mt-2 min-h-[80px] resize-none rounded-2xl border-border/70 bg-muted/40 px-4 py-3"
                            />
                          </div>

                          <div className="space-y-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowThumbnailInput(!showThumbnailInput)}
                              className="h-11 w-full rounded-2xl border-border/70"
                            >
                              {showThumbnailInput ? "Hide" : "Change"} Thumbnail
                            </Button>

                            <AnimatePresence initial={false}>
                              {showThumbnailInput && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden"
                                >
                                  <Label htmlFor="thumbnail" className="text-sm font-medium">
                                    Thumbnail URL
                                  </Label>
                                  <Input
                                    id="thumbnail"
                                    type="url"
                                    placeholder="https://..."
                                    value={thumbnailUrl}
                                    onChange={(e) => setThumbnailUrl(e.target.value)}
                                    className="mt-2 h-12 rounded-2xl border-border/70 bg-muted/40 px-4"
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <motion.div whileTap={{ scale: 0.98 }}>
                            <Button
                              onClick={handlePost}
                              disabled={submitState !== null}
                              className="h-12 w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90"
                            >
                              {submitState === "post" ? (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                                  className="inline-flex items-center"
                                >
                                  <Check className="mr-1.5 h-5 w-5" /> Posted
                                </motion.span>
                              ) : (
                                "Post"
                              )}
                            </Button>
                          </motion.div>
                          <motion.div whileTap={{ scale: 0.98 }}>
                            <Button
                              onClick={handleSaveAsDraft}
                              variant="outline"
                              className="h-12 w-full rounded-2xl border-border/70"
                              disabled={saveDraft.isPending || submitState !== null}
                            >
                              {submitState === "draft" ? (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                                  className="inline-flex items-center"
                                >
                                  <Check className="mr-1.5 h-5 w-5" /> Saved
                                </motion.span>
                              ) : saveDraft.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                "Save as Draft"
                              )}
                            </Button>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Success ripple overlay */}
                  <AnimatePresence>
                    {submitState && (
                      <motion.div
                        className="pointer-events-none absolute inset-0 grid place-items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.span
                          className="block rounded-full bg-foreground/10"
                          initial={{ width: 0, height: 0 }}
                          animate={{ width: 600, height: 600, opacity: [0.6, 0] }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
};
