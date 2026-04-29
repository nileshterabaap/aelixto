import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PostDraft {
  id: string;
  user_id: string;
  link_url: string | null;
  caption: string | null;
  title: string | null;
  thumbnail_url: string | null;
  embed_html: string | null;
  platform: string | null;
  media_type: string | null;
  og_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftInput {
  link_url?: string | null;
  caption?: string | null;
  title?: string | null;
  thumbnail_url?: string | null;
  embed_html?: string | null;
  platform?: string | null;
  media_type?: string | null;
  og_type?: string | null;
}

export const useDrafts = (userId?: string) => {
  return useQuery({
    queryKey: ["post-drafts", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("post_drafts")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PostDraft[];
    },
    enabled: !!userId,
  });
};

export const useSaveDraft = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: DraftInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("post_drafts")
        .insert({ user_id: user.id, ...draft })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-drafts"] });
      toast.success("Draft saved");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save draft");
    },
  });
};

export const useDeleteDraft = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.from("post_drafts").delete().eq("id", draftId);
      if (error) throw error;
      return draftId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-drafts"] });
    },
  });
};
