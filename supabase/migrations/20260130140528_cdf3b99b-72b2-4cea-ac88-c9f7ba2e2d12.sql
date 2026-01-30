-- Create app_settings table to store VAPID keys and other app-wide settings
CREATE TABLE public.app_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on app_settings (only service role can read/write VAPID keys)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only allow read access to public key for authenticated users
CREATE POLICY "Authenticated users can read public settings"
  ON public.app_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND key = 'vapid_public_key');

-- Service role has full access (handled automatically)
-- Private key should never be exposed to clients