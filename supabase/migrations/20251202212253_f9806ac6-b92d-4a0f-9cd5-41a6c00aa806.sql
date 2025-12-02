-- Create storage bucket for permanent thumbnail storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-thumbnails',
  'post-thumbnails', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to thumbnails
CREATE POLICY "Public can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-thumbnails');

-- Allow service role to upload thumbnails
CREATE POLICY "Service role can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-thumbnails');

-- Allow service role to update thumbnails
CREATE POLICY "Service role can update thumbnails"
ON storage.objects FOR UPDATE
USING (bucket_id = 'post-thumbnails');