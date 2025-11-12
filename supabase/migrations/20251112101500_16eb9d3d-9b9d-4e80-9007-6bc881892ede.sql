-- Add policies to allow edge functions to cache link previews
CREATE POLICY "Service role can insert link previews"
  ON public.link_previews
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update link previews"
  ON public.link_previews
  FOR UPDATE
  USING (true)
  WITH CHECK (true);