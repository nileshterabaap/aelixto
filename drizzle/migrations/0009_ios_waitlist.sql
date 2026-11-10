CREATE TABLE public.ios_waitlist (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE CHECK (char_length(email) <= 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'), created_at timestamptz NOT NULL DEFAULT now());
GRANT INSERT ON public.ios_waitlist TO anon, authenticated;
GRANT ALL ON public.ios_waitlist TO service_role;
ALTER TABLE public.ios_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist" ON public.ios_waitlist FOR INSERT TO anon, authenticated WITH CHECK (true);