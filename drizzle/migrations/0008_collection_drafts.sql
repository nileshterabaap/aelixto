CREATE TABLE public.collection_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.post_drafts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, draft_id)
);

CREATE INDEX collection_drafts_draft_id_idx ON public.collection_drafts (draft_id);

GRANT SELECT, INSERT, DELETE ON public.collection_drafts TO authenticated;
GRANT ALL ON public.collection_drafts TO service_role;

ALTER TABLE public.collection_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view drafts in their collections" ON public.collection_drafts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users can add their drafts to their collections" ON public.collection_drafts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.post_drafts d WHERE d.id = draft_id AND d.user_id = auth.uid())
  );

CREATE POLICY "Users can remove drafts from their collections" ON public.collection_drafts
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
  );