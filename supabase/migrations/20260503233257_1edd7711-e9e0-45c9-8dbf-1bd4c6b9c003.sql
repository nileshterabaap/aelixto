-- Add metadata column to notifications for storing report context (post snapshot, action type)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add status tracking columns to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolution text;