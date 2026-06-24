
CREATE OR REPLACE FUNCTION public.update_post_dimensions(
  _post_id uuid,
  _height integer,
  _aspect numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_height integer;
  current_aspect numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF _height IS NULL OR _height < 80 OR _height > 4000 THEN
    RETURN;
  END IF;

  SELECT suggested_height, aspect_ratio
    INTO current_height, current_aspect
    FROM public.posts
   WHERE id = _post_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only write when height differs by more than 5% (or is unset).
  IF current_height IS NULL
     OR ABS(current_height - _height) > GREATEST(20, current_height * 0.05) THEN
    UPDATE public.posts
       SET suggested_height = _height,
           aspect_ratio = COALESCE(_aspect, current_aspect, aspect_ratio)
     WHERE id = _post_id;
  ELSIF _aspect IS NOT NULL
        AND (current_aspect IS NULL OR ABS(current_aspect - _aspect) > 0.05) THEN
    UPDATE public.posts
       SET aspect_ratio = _aspect
     WHERE id = _post_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_post_dimensions(uuid, integer, numeric) TO authenticated;
