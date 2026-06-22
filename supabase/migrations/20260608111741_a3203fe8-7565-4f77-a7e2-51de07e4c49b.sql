
UPDATE public.posts SET media_kind = 'video',   aspect_ratio = 1.7778 WHERE media_kind IS NULL AND platform = 'youtube';
UPDATE public.posts SET media_kind = 'video',   aspect_ratio = 0.5625 WHERE media_kind IS NULL AND platform = 'tiktok';
UPDATE public.posts SET media_kind = 'image',   aspect_ratio = 1.0    WHERE media_kind IS NULL AND platform = 'instagram';
UPDATE public.posts SET media_kind = 'image',   aspect_ratio = 0.75   WHERE media_kind IS NULL AND platform = 'pinterest';
UPDATE public.posts SET media_kind = 'audio',   suggested_height = 352 WHERE media_kind IS NULL AND platform = 'spotify';
