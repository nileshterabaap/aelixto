
-- Collections table
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own collections" ON public.collections
  FOR SELECT TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own collections" ON public.collections
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections" ON public.collections
  FOR UPDATE TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections" ON public.collections
  FOR DELETE TO public USING (auth.uid() = user_id);

-- Collection items (junction table)
CREATE TABLE public.collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collection_id, post_id)
);

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items in their collections" ON public.collection_items
  FOR SELECT TO public USING (
    EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can add items to their collections" ON public.collection_items
  FOR INSERT TO public WITH CHECK (
    EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can remove items from their collections" ON public.collection_items
  FOR DELETE TO public USING (
    EXISTS (SELECT 1 FROM public.collections WHERE id = collection_id AND user_id = auth.uid())
  );
