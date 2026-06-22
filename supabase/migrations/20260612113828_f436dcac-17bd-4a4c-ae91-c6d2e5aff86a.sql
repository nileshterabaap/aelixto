UPDATE public.posts
SET thumbnail_url = NULL
WHERE platform = 'reddit'
  AND thumbnail_url ILIKE '%share.redd.it/preview/post%';

UPDATE public.posts
SET preview_image_url = NULL
WHERE platform = 'reddit'
  AND preview_image_url ILIKE '%share.redd.it/preview/post%';