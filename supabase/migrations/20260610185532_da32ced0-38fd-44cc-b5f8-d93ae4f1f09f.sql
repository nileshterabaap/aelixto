
-- 4-digit signup OTP system
CREATE TABLE public.signup_otps (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.signup_otps TO service_role;
ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;
-- No public policies: edge functions use service role only.

-- Email verification flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
