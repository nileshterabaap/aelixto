import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type BucketName = "avatars" | "covers" | "posts";

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (
    file: File,
    bucket: BucketName,
    userId: string
  ): Promise<string | null> => {
    try {
      setUploading(true);

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file",
          variant: "destructive",
        });
        return null;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB",
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
            contentType: file.type || "image/jpeg",
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

      toast({
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
