import { useState, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Link2, Loader2, Sparkles, X, Check } from "lucide-react";
import { useCreatePost } from "@/hooks/usePosts";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { supabase } from "@/integrations/supabase/client";
import { setKeyboardOverlayMode } from "@/lib/keyboardInsets";
import { classifyUrl, deriveMediaType } from "@/config/platformRegistry";
import {
  extractRootDomain,
  getDomainOverride,
  recordDomainClassification,
} from "@/lib/domainClassification";
import { useSaveDraft, useDeleteDraft, type PostDraft } from "@/hooks/useDrafts";
import { useDailyPostLimit } from "@/hooks/useDailyPostLimit";
import { measureEmbedHeight } from "@/lib/measureEmbedHeight";
import { estimateEmbedHeight } from "@/lib/estimateEmbedHeight";
import { extractOriginalCaptionFromSourceTitle } from "@/lib/originalCaption";
import { getPostThumb } from "@/lib/getPostThumb";
import { getThumbnailText } from "@/lib/getThumbnailText";
import { TextCardThumbnail } from "@/components/TextCardThumbnail";

const isYouTubeShortUrl = (url: string) => decodeURIComponent(url).toLowerCase().includes('/shorts/');

// Extract the first http(s) URL from a pasted string (which may include
// share-sheet text like "Answer to ... by X https://...?ch=...").
const extractUrlFromText = (raw: string): string => {
  if (!raw) return raw;
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  if (match) return match[0].replace(/[.,;:!?)\]]+$/, '');
  // No protocol found — take the first whitespace-delimited token and
  // add https:// if it looks like a domain.
  const first = trimmed.split(/\s+/)[0];
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(first)) return `https://${first}`;
  return trimmed;
};

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
  const { uploadImage, uploading: uploadingThumbnail } = useImageUpload();
  const {
    reached: limitReached,
    remaining,
    limit,
    increment: incrementDailyCount,
    isUnlimited,
    resetCountdown,
    resetLabel,
  } = useDailyPostLimit();
  // Height measured offscreen at create-time so the very first viewer
  // (including the creator) opens the card at its real size — no blank space.
  const measuredHeightRef = useRef<number | null>(null);
  const measurePromiseRef = useRef<Promise<number | null> | null>(null);
  // Original post body fetched from the source link (Facebook/Reddit/Threads/etc.).
  // Stored separately from the user's caption and saved as posts.preview_text so
  // it renders inside the embedded card without ever touching the user's own caption.
  const fetchedPreviewTextRef = useRef<string | null>(null);

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
    let resolvedUrl = linkUrl.trim();
    // LinkedIn now shares posts as lnkd.in short links. Expand them to the real
    // linkedin.com/posts/... URL so the post is classified + embedded as LinkedIn
    // instead of falling through to Article/External.
    if (/^https?:\/\/(www\.)?lnkd\.in\//i.test(resolvedUrl)) {
      try {
        setIsLoadingPreview(true);
        const { data } = await supabase.functions.invoke('expand-url', {
          body: { url: resolvedUrl },
        });
        const finalUrl = typeof data?.finalUrl === 'string' ? data.finalUrl : '';
        if (finalUrl && finalUrl.toLowerCase().includes('linkedin.com')) {
          resolvedUrl = finalUrl.split('?')[0];
          setLinkUrl(resolvedUrl);
        }
      } catch (e) {
        console.warn('[CreatePostDialog] lnkd.in expansion failed:', e);
      } finally {
        setIsLoadingPreview(false);
      }
    }
    return processLinkSubmit(resolvedUrl);
  };

  const processLinkSubmit = async (linkUrl: string) => {
    if (!linkUrl.trim()) return;
    fetchedPreviewTextRef.current = null;
    measuredHeightRef.current = null;
    measurePromiseRef.current = null;
    
    setIsLoadingPreview(true);
    
    // Auto-generate thumbnail URL and fetch title based on platform
    let thumbnail = "";
    let videoTitle = "";
    let detectedOgType: string | null = ogType;
    
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
        // Reddit's og:image is frequently the generic orange logo
        // (share.redd.it/preview/post/...). Use fetch-post-preview which
        // pulls the real post thumbnail from Reddit's JSON API so the
        // create-time preview and the saved post both render the actual
        // media instead of a typographic fallback.
        console.log('[CreatePostDialog] Fetching Reddit preview via fetch-post-preview');
        try {
          const { data: previewData, error } = await supabase.functions.invoke('fetch-post-preview', {
            body: { url: linkUrl, platform: 'reddit', previewOnly: true }
          });
          if (!error && previewData) {
            videoTitle = previewData.title || "";
            thumbnail = previewData.thumbnail_url || "";
            const previewText = previewData.preview_text ? String(previewData.preview_text).trim() : "";
            if (!fetchedPreviewTextRef.current && previewText && !/^view on |^posted by u\//i.test(previewText)) {
              fetchedPreviewTextRef.current = previewText.slice(0, 4000);
            }
          }
        } catch (error) {
          console.error('[CreatePostDialog] Reddit preview fetch failed:', error);
        }
      } else if (linkUrl.includes("instagram.com") || linkUrl.includes("facebook.com") || linkUrl.includes("fb.watch") || linkUrl.includes("fb.me")) {
        const platform = linkUrl.includes("instagram.com") ? "instagram" : "facebook";
        if (platform === "facebook") {
          try {
            const { data: previewData, error } = await supabase.functions.invoke('fetch-post-preview', {
              body: { url: linkUrl, platform: 'facebook', previewOnly: true }
            });
            if (!error && previewData) {
              videoTitle = previewData.title || "";
              thumbnail = previewData.thumbnail_url || "";
              const previewText = previewData.preview_text ? String(previewData.preview_text).trim() : "";
              if (previewText && !/^view on |^facebook$/i.test(previewText)) {
                fetchedPreviewTextRef.current = previewText.slice(0, 4000);
              }
            }
          } catch (error) {
            console.error('[CreatePostDialog] Facebook preview fetch failed:', error);
          }
        }
        try {
          const { data, error } = await supabase.functions.invoke('fetch-meta-thumbnail', {
            body: { url: linkUrl, platform }
          });
          if (!error && data) {
            if (!videoTitle) videoTitle = data.title || "";
            if (!thumbnail) thumbnail = data.thumbnail || "";
            if (platform === 'facebook' && !fetchedPreviewTextRef.current) {
              const fullCaption = extractOriginalCaptionFromSourceTitle({
                title: data.title,
                platform: 'facebook',
              });
              if (fullCaption) {
                fetchedPreviewTextRef.current = fullCaption.slice(0, 4000);
              }
            }
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
            if (ogData.og_type) { setOgType(ogData.og_type); detectedOgType = ogData.og_type; }
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
            const previewText = ogData.description ? String(ogData.description).trim() : "";
            if (!fetchedPreviewTextRef.current && previewText && !/^view on |^@/i.test(previewText)) {
              fetchedPreviewTextRef.current = previewText.slice(0, 4000);
            }
          }
        } catch (error) {
          console.error('[CreatePostDialog] Twitter OG fetch failed:', error);
        }
      } else if (linkUrl.includes("tiktok.com")) {
        try {
          const { data: previewData, error } = await supabase.functions.invoke('fetch-post-preview', {
            body: { url: linkUrl, platform: 'tiktok', previewOnly: true }
          });
          if (!error && previewData) {
            if (!videoTitle && previewData.title) videoTitle = previewData.title;
            if (!thumbnail && previewData.thumbnail_url) thumbnail = previewData.thumbnail_url;
            const previewText = previewData.preview_text ? String(previewData.preview_text).trim() : "";
            if (!fetchedPreviewTextRef.current && previewText && !/^view on /i.test(previewText)) {
              fetchedPreviewTextRef.current = previewText.slice(0, 4000);
            }
          }
        } catch (error) {
          console.error('[CreatePostDialog] TikTok preview fetch failed:', error);
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
            if (ogData.og_type) { setOgType(ogData.og_type); detectedOgType = ogData.og_type; }
            // Capture the original post body for platforms whose text lives in
            // OG description (Facebook, Reddit, Threads). Stored separately from
            // the user's caption — never overwrites what the user typed.
            if (!fetchedPreviewTextRef.current && ogData.description) {
              const lower = linkUrl.toLowerCase();
              const wantsAutoCaption =
                lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.me') ||
                lower.includes('reddit.com') ||
                lower.includes('threads.net') || lower.includes('threads.com') ||
                lower.includes('twitter.com') || lower.includes('x.com');
              if (wantsAutoCaption) {
                const desc = String(ogData.description).trim();
                const fullFacebookCaption = extractOriginalCaptionFromSourceTitle({
                  title: ogData.title,
                  platform: lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.me') ? 'facebook' : undefined,
                });
                if (fullFacebookCaption) {
                  fetchedPreviewTextRef.current = fullFacebookCaption.slice(0, 4000);
                } else if (desc && !/^view on |^posted by u\//i.test(desc)) {
                  fetchedPreviewTextRef.current = desc.slice(0, 4000);
                }
              }
            }
          } else {
            console.error('[CreatePostDialog] OG fetch error:', error);
          }
        } catch (error) {
          console.error('[CreatePostDialog] Failed to fetch OG data:', error);
        }
      }

      // For Facebook/Reddit/Threads: even when a thumbnail was already found
      // by the platform-specific branch above, we still need a separate OG
      // pass to grab the post body. Stored as preview_text — independent of
      // the user's caption.
      if (!fetchedPreviewTextRef.current) {
        const lower = linkUrl.toLowerCase();
        const wantsAutoCaption =
          lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.me') ||
          lower.includes('reddit.com') ||
          lower.includes('threads.net') || lower.includes('threads.com') ||
          lower.includes('twitter.com') || lower.includes('x.com');
        if (wantsAutoCaption) {
          try {
            const { data: ogData2 } = await supabase.functions.invoke('fetch-og', {
              body: { url: linkUrl }
            });
            const fullFacebookCaption = extractOriginalCaptionFromSourceTitle({
              title: ogData2?.title,
              platform: lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.me') ? 'facebook' : undefined,
            });
            const desc = ogData2?.description ? String(ogData2.description).trim() : '';
            if (fullFacebookCaption) {
              fetchedPreviewTextRef.current = fullFacebookCaption.slice(0, 4000);
            } else if (desc && !/^view on |^posted by u\//i.test(desc)) {
              fetchedPreviewTextRef.current = desc.slice(0, 4000);
            }
          } catch (e) {
            console.warn('[CreatePostDialog] Preview text fetch skipped:', e);
          }
        }
      }
      
      // Fetch oEmbed HTML in parallel for instant embed rendering
      console.log('[CreatePostDialog] Fetching oEmbed HTML...');
      let fetchedEmbedHtml = "";
      try {
        const { data: oembedData, error: oembedError } = await supabase.functions.invoke('fetch-oembed', {
          body: { url: linkUrl }
        });
        if (!oembedError && oembedData?.embed_html) {
          setEmbedHtml(oembedData.embed_html);
          fetchedEmbedHtml = oembedData.embed_html;
          console.log('[CreatePostDialog] Got oEmbed HTML, length:', oembedData.embed_html.length);
        }
      } catch (error) {
        console.error('[CreatePostDialog] oEmbed fetch failed:', error);
      }

      // Threads' og:image is the author's profile picture, never the post's
      // own media. Drop it so the typographic text card renders instead
      // (matches X / Reddit behavior).
      {
        const lowerLink = linkUrl.toLowerCase();
        const isThreadsLink = lowerLink.includes('threads.net') || lowerLink.includes('threads.com');
        if (isThreadsLink && thumbnail) {
          const t = thumbnail.toLowerCase();
          const isMetaAvatar =
            t.includes('profile_pic') ||
            /\/t\d+\.[\d-]*-19\//.test(t) ||
            /[?&]stp=[^&]*_19/.test(t);
          if (isMetaAvatar) thumbnail = "";
        }
      }

      setThumbnailUrl(thumbnail);
      setTitle(videoTitle);

      // Smart privacy check — verify the source is publicly accessible.
      const platform = classifyUrl(linkUrl, detectedOgType);
      const platformLabel = platform && platform !== "external"
        ? platform.charAt(0).toUpperCase() + platform.slice(1)
        : "this site";
      let verdict: string | undefined;
      try {
        const { data: validation } = await supabase.functions.invoke(
          "validate-post-source",
          { body: { url: linkUrl, platform } }
        );
        verdict = validation?.verdict;
      } catch (err) {
        console.error("[CreatePostDialog] Privacy check failed:", err);
      }

      if (verdict === "removed") {
        toast.error(
          `We couldn't load this ${platformLabel} post. It looks private, deleted, or region-restricted — try a different link.`,
          { duration: 6000 }
        );
        return;
      }

      // Content-availability check — if we got nothing usable to render,
      // tell the user the likely reason instead of letting them publish a broken card.
      const hasAnyContent = Boolean(thumbnail) || Boolean(fetchedEmbedHtml) || Boolean(videoTitle);
      if (!hasAnyContent) {
        if (platform === "external") {
          toast.error(
            "We couldn't read this link. It may not be a supported platform, the page may block previews, or the URL might be wrong.",
            { duration: 6000 }
          );
        } else {
          toast.error(
            `We couldn't fetch this ${platformLabel} post. It may be private, deleted, age- or region-restricted, or ${platformLabel} is blocking the preview right now. Double-check the link or try another post.`,
            { duration: 6000 }
          );
        }
        return;
      }

      setStep(2);

      // Kick off offscreen measurement in the background. Works best for
      // Threads + Facebook (they postMessage their rendered height). For
      // other platforms this resolves null and the viewer-time persistence
      // takes over on first scroll.
      measuredHeightRef.current = null;
      measurePromiseRef.current = measureEmbedHeight(linkUrl)
        .then((h) => {
          measuredHeightRef.current = h;
          return h;
        })
        .catch(() => null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const promptSectionFeedback = (
    postId: string | undefined,
    url: string,
    currentType: "article" | "external"
  ) => {
    if (!postId) return;
    const domain = extractRootDomain(url);
    if (!domain) return;
    const otherType: "article" | "external" =
      currentType === "article" ? "external" : "article";
    const otherLabel = otherType === "article" ? "Articles" : "External";
    const currentLabel = currentType === "article" ? "Articles" : "External";

    const id = toast(
      `Posted to ${currentLabel}. Wrong section?`,
      {
        description: `Move it to ${otherLabel} — Aelixto will remember ${domain} for next time.`,
        duration: 12000,
        action: {
          label: `Move to ${otherLabel}`,
          onClick: async () => {
            try {
              const { error } = await supabase
                .from("posts")
                .update({ platform: otherType })
                .eq("id", postId);
              if (error) throw error;
              await recordDomainClassification(domain, otherType);
              toast.success(`Moved to ${otherLabel}. Aelixto will remember.`);
            } catch (e: any) {
              toast.error(e?.message || "Couldn't move the post.");
            }
          },
        },
        cancel: {
          label: "Keep here",
          onClick: async () => {
            // Confirming the current placement also teaches the system.
            try { await recordDomainClassification(domain, currentType); } catch {}
          },
        },
      }
    );
    return id;
  };

  const handlePost = async () => {
    if (!linkUrl.trim()) return;

    if (limitReached) {
      toast.error(`Your daily slots reset in ${resetCountdown}`, {
        description: resetLabel,
      });
      return;
    }

    // Use centralised classification
    let platform = classifyUrl(linkUrl, ogType);

    // Apply user-learned override for unknown sites (article vs external).
    if (platform === "article" || platform === "external") {
      const domain = extractRootDomain(linkUrl);
      const override = await getDomainOverride(domain);
      if (override) platform = override;
    }

    const mediaType = deriveMediaType(linkUrl, platform);
    const isYouTubeShort = platform === "youtube" && isYouTubeShortUrl(linkUrl);

    // Final safety net — never publish a card with nothing to show.
    if (!thumbnailUrl && !embedHtml && !title.trim()) {
      const label = platform && platform !== "external"
        ? platform.charAt(0).toUpperCase() + platform.slice(1)
        : "this link";
      toast.error(
        `We couldn't find any content for this ${label} post. It may be private, deleted, or unsupported — try a different link.`,
        { duration: 6000 }
      );
      return;
    }

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

    // Give the offscreen measurement up to ~1.2s extra to settle, then
    // post with whatever height we have (or null = fall back to defaults).
    let suggestedHeight: number | null = measuredHeightRef.current;
    if (suggestedHeight === null && measurePromiseRef.current) {
      suggestedHeight = await Promise.race([
        measurePromiseRef.current,
        new Promise<number | null>((r) => window.setTimeout(() => r(null), 1200)),
      ]);
    }

    // Fallback: if the platform didn't broadcast a height (Instagram,
    // TikTok, LinkedIn, Pinterest, etc.) compute a content-aware estimate
    // from the data we already have (caption length, thumbnail, platform).
    // This gives the very first viewer a card sized close to the real
    // content instead of a generic 380px stub.
    if (suggestedHeight === null) {
      try {
        suggestedHeight = estimateEmbedHeight({
          platform,
          url: linkUrl,
          caption: caption,
          title: title,
          thumbnailUrl: thumbnailUrl,
        });
      } catch {
        suggestedHeight = null;
      }
    }

    createPost.mutate({
      title: title.trim() || undefined,
      content: caption.trim() || "",
      media_type: mediaType,
      media_url: linkUrl,
      platform: platform,
      thumbnail_url: thumbnailUrl || undefined,
      embed_html: embedHtml || undefined,
      media_kind: isYouTubeShort ? "short" : undefined,
      aspect_ratio: isYouTubeShort ? 9 / 16 : undefined,
      suggested_height: suggestedHeight,
      preview_text: fetchedPreviewTextRef.current || undefined,
    }, {
      onSuccess: (created: any) => {
        incrementDailyCount();
        if (platform === "article" || platform === "external") {
          promptSectionFeedback(created?.id, linkUrl, platform);
        }
      },
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
    const isYouTubeShort = platform === "youtube" && isYouTubeShortUrl(linkUrl);
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
    fetchedPreviewTextRef.current = null;
    measuredHeightRef.current = null;
    measurePromiseRef.current = null;
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep(1);
    setShowThumbnailInput(false);
  };

  // Android: while the box is open the keyboard OVERLAYS the page instead of
  // resizing the WebView. A WebView resize relayouts the whole embed-heavy
  // feed and re-fires every IntersectionObserver (media suspend/pre-warm
  // swaps) — that relayout, landing ~0.5–1s after the close tap when the
  // keyboard had finished hiding, was the "screen lock + flicker". In overlay
  // mode nothing underneath ever changes size.
  useEffect(() => {
    if (!open) return;
    void setKeyboardOverlayMode(true);
    return () => {
      // Hand ownership back only once the keyboard is gone; switching while it
      // is still visible would itself trigger the resize we are avoiding.
      window.setTimeout(() => { void setKeyboardOverlayMode(false); }, 450);
    };
  }, [open]);

  const handleClose = () => {
    // Drop the soft keyboard NOW, together with the backdrop fade, so the IME
    // hide runs alongside the exit animation instead of after it.
    (document.activeElement as HTMLElement | null)?.blur?.();
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
    fetchedPreviewTextRef.current = null;
    measuredHeightRef.current = null;
    measurePromiseRef.current = null;
    onOpenChange(false);
  };

  const stepVariants = {
    initial: (dir: number) => ({ opacity: 0, x: dir * 18, filter: "blur(5px)" }),
    animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (dir: number) => ({ opacity: 0, x: -dir * 18, filter: "blur(5px)" }),
  };

  const panelTransition = { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.82 };

  return (
    // modal={false}: Radix's modal mode locks body scroll, sets
    // `pointer-events:none` on <body> and aria-hides every sibling; all of that
    // is torn down only after the exit animation finishes — ~0.5–1s after the
    // close tap — which forces a full relayout of the embed-heavy feed on the
    // Android WebView and shows as a one-frame flicker. Non-modal skips those
    // body/tree mutations entirely; our own backdrop blocks interaction and
    // taps on it still dismiss via Radix's outside-press handling.
    <DialogPrimitive.Root open={open} onOpenChange={handleClose} modal={false}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Backdrop (plain tint — no backdrop-filter, see above) */}
            <motion.div
              aria-hidden
              className="fixed inset-0 z-50 bg-foreground/55 touch-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: "opacity", backfaceVisibility: "hidden" }}
            />

            {/* Centered card with viewport-safe sizing */}
            <DialogPrimitive.Content
              asChild
              forceMount
              aria-describedby={undefined}
              // Don't hand focus back to the FAB when the box unmounts — on the
              // WebView that late focus() is another relayout trigger.
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                className="fixed left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-md outline-none transition-[top] duration-200 ease-out"
                initial={{ opacity: 0, scale: 0.18, x: "-50%", y: "calc(-50% + 230px)" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                // Short, non-spring exit: a spring "settles" for close to a
                // second, which is exactly how long the box (and anything it
                // tears down) lingered after the tap.
                exit={{
                  opacity: 0, scale: 0.92, x: "-50%", y: "calc(-50% + 28px)",
                  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
                }}
                transition={panelTransition}
                style={{
                  // Centre inside the part of the screen the keyboard does not
                  // cover (--kb is 0 whenever the viewport itself shrank).
                  top: "calc((100dvh - var(--kb, 0px)) / 2)",
                  transformOrigin: "50% calc(100% + 120px)",
                  willChange: "transform, opacity",
                }}
              >
                <motion.div
                  transition={panelTransition}
                  className="relative max-h-[calc(100dvh-var(--kb,0px)-1.5rem)] overflow-hidden rounded-[32px] bg-background shadow-[0_34px_90px_-24px_hsl(var(--foreground)/0.45)] ring-1 ring-border/15"
                >
                  {/* Soft gradient sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--foreground)/0.10),transparent_42%)]" />
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted"
                    initial={{ scaleX: 0.35, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: 0.08, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  />

                  {/* Header */}
                  <div className="relative flex items-center justify-between px-6 pt-7 pb-3">
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={{ scale: 0.2, rotate: -45, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 540, damping: 30, delay: 0.04 }}
                        className="grid h-10 w-10 place-items-center rounded-2xl bg-foreground text-background shadow-[0_14px_28px_-18px_hsl(var(--foreground)/0.9)]"
                      >
                        {step === 1 ? <Link2 className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                      </motion.div>
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
                          className="text-[1.0625rem] font-semibold tracking-normal"
                        >
                          {step === 1 ? "Create post" : "Add details"}
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
                  <div className="relative max-h-[calc(100dvh-7rem)] overflow-y-auto px-6 pb-6 pt-2 overscroll-contain">
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
                          className="space-y-5"
                        >
                          <div>
                            <Label htmlFor="link" className="text-sm font-medium text-foreground/80">
                              Paste your link
                            </Label>
                            <input
                              id="link"
                              type="url"
                              placeholder=" "
                              value={linkUrl}
                              onChange={(e) => {
                                const raw = e.target.value;
                                // If user pasted share text like
                                // "Answer to ... by X https://quora.com/...",
                                // auto-extract the URL so downstream logic
                                // recognises the platform.
                                const looksLikeText = /\s/.test(raw.trim()) || /^[A-Za-z]/.test(raw.trim());
                                const cleaned = looksLikeText ? extractUrlFromText(raw) : raw;
                                setLinkUrl(cleaned);
                              }}
                              className="mt-2 h-14 w-full rounded-[24px] border border-input bg-background px-4 text-base outline-none shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_0_0_4px_hsl(var(--muted)/0.75)] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus:border-foreground/25 focus:shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_0_0_5px_hsl(var(--foreground)/0.06)]"
                            />
                          </div>

                          <motion.div whileTap={{ scale: 0.985 }}>
                            <Button
                              onClick={handleLinkSubmit}
                              className="relative h-12 w-full overflow-hidden rounded-[22px] bg-foreground text-background shadow-[0_18px_38px_-26px_hsl(var(--foreground)/0.9)] transition-transform hover:bg-foreground/90"
                              disabled={!linkUrl.trim() || isLoadingPreview}
                            >
                              <motion.span
                                aria-hidden
                                className="absolute inset-y-0 -left-1/3 w-1/3 bg-background/15"
                                animate={{ x: ["0%", "430%"] }}
                                transition={{ repeat: Infinity, repeatDelay: 1.6, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                              />
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
                          {(() => {
                            const previewPlatform = classifyUrl(linkUrl, ogType);
                            const syntheticPost = {
                              platform: previewPlatform,
                              title,
                              content: caption,
                              thumbnail_url: thumbnailUrl,
                              preview_text: fetchedPreviewTextRef.current,
                              embed_html: embedHtml,
                            };
                            const resolvedThumb = getPostThumb(syntheticPost);
                            const textSource = getThumbnailText(syntheticPost);
                            const hasAnyPreview = !!resolvedThumb || !!textSource ||
                              ["x", "twitter", "threads", "reddit"].includes(previewPlatform);
                            if (!hasAnyPreview) return null;
                            return (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden rounded-2xl border border-border/60"
                              >
                                {resolvedThumb ? (
                                  <img
                                    src={resolvedThumb}
                                    alt="Preview"
                                    className="h-48 w-full object-cover"
                                    onError={() => setThumbnailUrl("")}
                                  />
                                ) : (
                                  <div className="h-48 w-full">
                                    <TextCardThumbnail
                                      platform={previewPlatform}
                                      text={textSource}
                                      aspect="h-full"
                                    />
                                  </div>
                                )}
                              </motion.div>
                            );
                          })()}

                          <div>
                            <Label htmlFor="caption" className="text-sm font-medium text-foreground/80">
                              Caption (optional)
                            </Label>
                            <Textarea
                              id="caption"
                              placeholder="Write a caption..."
                              value={caption}
                              onChange={(e) => setCaption(e.target.value)}
                              className="mt-2 min-h-[88px] resize-none rounded-[24px] border-input bg-background px-4 py-3 text-base outline-none shadow-[0_0_0_4px_hsl(var(--muted)/0.75)] focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-foreground/25 focus:shadow-[0_0_0_5px_hsl(var(--foreground)/0.06)]"
                            />
                          </div>

                          <div className="space-y-2">
                            <ImageUploadButton
                              uploading={uploadingThumbnail}
                              onFileSelect={async (file) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) {
                                  toast.error("Please sign in to upload a thumbnail");
                                  return;
                                }
                                const url = await uploadImage(file, "posts", user.id);
                                if (url) setThumbnailUrl(url);
                              }}
                              className="h-11 rounded-[20px] border-input bg-background"
                            >
                              {thumbnailUrl ? "Change Thumbnail" : "Choose Thumbnail from Gallery"}
                            </ImageUploadButton>
                            {thumbnailUrl && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setThumbnailUrl("")}
                                className="h-9 w-full rounded-[18px] text-xs text-muted-foreground"
                              >
                                Remove thumbnail
                              </Button>
                            )}
                          </div>

                          <motion.div whileTap={{ scale: 0.98 }}>
                            <Button
                              onClick={handlePost}
                              disabled={submitState !== null || limitReached}
                              className="h-12 w-full rounded-[22px] bg-foreground text-background shadow-[0_18px_38px_-26px_hsl(var(--foreground)/0.9)] hover:bg-foreground/90"
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
                              ) : limitReached ? (
                                "Daily slots used"
                              ) : (
                                "Post"
                              )}
                            </Button>
                          </motion.div>
                          {limitReached ? (
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">
                                Your daily slots reset in {resetCountdown}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                {resetLabel}
                              </p>
                            </div>
                          ) : (
                            <p className="text-center text-xs text-muted-foreground">
                              {isUnlimited
                                ? "Unlimited slots"
                                : `${remaining} of ${limit} slots remaining today`}
                            </p>
                          )}
                          <motion.div whileTap={{ scale: 0.98 }}>
                            <Button
                              onClick={handleSaveAsDraft}
                              variant="outline"
                              className="h-12 w-full rounded-[22px] border-input bg-background"
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
                </motion.div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
};
