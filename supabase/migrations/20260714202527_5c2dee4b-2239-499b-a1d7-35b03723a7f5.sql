-- 1) Find duplicates to delete and decrement author scores by the removed count
WITH ranked AS (
  SELECT id, author_id,
         row_number() OVER (
           PARTITION BY post_id, COALESCE(viewer_id::text, device_hash), event_type
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.post_views
),
dups AS (
  SELECT id, author_id FROM ranked WHERE rn > 1
),
adj AS (
  SELECT author_id, count(*)::int AS n FROM dups GROUP BY author_id
),
decremented AS (
  UPDATE public.profiles p
     SET aelix_score = GREATEST(0, COALESCE(p.aelix_score, 0) - adj.n)
    FROM adj
   WHERE p.user_id = adj.author_id
  RETURNING 1
),
deleted AS (
  DELETE FROM public.post_views WHERE id IN (SELECT id FROM dups) RETURNING 1
)
SELECT (SELECT count(*) FROM deleted) AS removed_rows,
       (SELECT count(*) FROM decremented) AS profiles_adjusted;

-- 2) Enforce permanent dedup
DROP INDEX IF EXISTS public.uniq_post_view_guard;
CREATE UNIQUE INDEX uniq_post_view_guard
  ON public.post_views (post_id, COALESCE((viewer_id)::text, device_hash), event_type);