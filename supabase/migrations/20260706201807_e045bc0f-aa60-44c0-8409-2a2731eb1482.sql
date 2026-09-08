
-- 1) Loosen profiles SELECT: allow anyone authenticated (block enforced in UI + posts RLS)
DROP POLICY IF EXISTS "Profiles viewable unless blocked" ON public.profiles;
CREATE POLICY "Profiles publicly viewable"
  ON public.profiles FOR SELECT
  USING (true);

-- 2) Security definer function to detect if I am blocked by target
CREATE OR REPLACE FUNCTION public.am_i_blocked_by(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE user_id = _target AND blocked_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.am_i_blocked_by(uuid) TO authenticated;

-- 3) Add last_delivered_at to conversation_participants for WhatsApp-style ticks
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz DEFAULT now();
