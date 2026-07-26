UPDATE public.posts
SET thumbnail_url = NULL,
    preview_image_url = NULL,
    media_kind = 'text'
WHERE lower(platform) = 'threads'
  AND (
    thumbnail_url ILIKE '%profile_pic%'
    OR thumbnail_url ~ '/t[0-9]+\.[0-9-]*-19/'
    OR preview_image_url ILIKE '%profile_pic%'
    OR preview_image_url ~ '/t[0-9]+\.[0-9-]*-19/'
  );