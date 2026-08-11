import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type BucketName = "avatars" | "covers" | "posts";

interface UploadOptions {
  /** Suppress success/failure toasts (used in chat where UI shows progress). */
  silent?: boolean;
  /** Allow video files in addition to images. */
  allowVideo?: boolean;
  /** Max file size in bytes (defaults to 5MB). */
  maxBytes?: number;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (
    file: File,
    bucket: BucketName,
    userId: string,
    options: UploadOptions = {}
  ): Promise<string | null> => {
    const { silent = false, allowVideo = false, maxBytes } = options;
    const notify = (args: Parameters<typeof toast>[0]) => {
      if (!silent) toast(args);
    };
    try {
      setUploading(true);

      // Validate file type
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!(isImage || (allowVideo && isVideo))) {
        toast({
          title: "Invalid file type",
          description: allowVideo
            ? "Please upload an image or video file"
            : "Please upload an image file",
          variant: "destructive",
        });
        return null;
      }

      // Validate file size
      const limit = maxBytes ?? (isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024);
      if (file.size > limit) {
        toast({
          title: "File too large",
          description: `Please upload a file smaller than ${Math.round(
            limit / (1024 * 1024)
          )}MB`,
          variant: "destructive",
        });
        return null;
      }

      // Always derive the owner folder from the LIVE auth session. Storage RLS
      // checks `auth.uid() = foldername(name)[1]`, so a stale/expired session
      // (common on the native APK after it has been backgrounded) produced
      // "new row violates row-level security policy".
      const { data: sessionData } = await supabase.auth.getSession();
      let authedId = sessionData.session?.user?.id;

      if (!authedId) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        authedId = refreshed.session?.user?.id;
      }

      if (!authedId) {
        toast({
          title: "Session expired",
          description: "Please sign in again to upload images",
          variant: "destructive",
        });
        return null;
      }

      // Generate unique filename
      const fileExt = (file.name.split(".").pop() || "jpg").toLowerCase();

      const doUpload = (ownerId: string) => {
        const fileName = `${ownerId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${fileExt}`;
        return supabase.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"),
          })
          .then((res) => ({ ...res, fileName }));
      };

      let { error: uploadError, fileName } = await doUpload(authedId);

      // On the native APK the access token can expire mid-session; force a
      // refresh and retry once before surfacing an error to the user.
      if (uploadError) {
        const retryable =
          /row-level security|jwt|expired|401|403|unauthorized|Failed to fetch|network/i.test(
            uploadError.message
          );
        if (retryable) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          const retryId = refreshed.session?.user?.id ?? authedId;
          const retry = await doUpload(retryId);
          uploadError = retry.error;
          fileName = retry.fileName;
        }
      }

      if (uploadError) {
        console.error("Upload error:", uploadError);
        const isRls = /row-level security|jwt|401|403/i.test(uploadError.message);
        toast({
          title: "Upload failed",
          description: isRls
            ? "Your session expired. Please sign in again and retry."
            : uploadError.message,
          variant: "destructive",
        });
        return null;
      }

      // Get public URL
      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

      notify({
        title: "Upload successful",
        description: "Your image has been uploaded",
      });

      return data.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "An error occurred while uploading",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploading };
};
