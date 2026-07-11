import { supabase } from '@/integrations/supabase/client';

// Temporary diagnostic logger — writes to public.trace_logs.
// Remove this file and all callers after diagnosis.
export function traceLog(
  event: string,
  step: string,
  opts: { postId?: string | null; platform?: string | null; detail?: any; error?: any } = {},
) {
  try {
    // Fire-and-forget; never block UI.
    // NOTE: supabase.from().insert() is lazy — it only executes when .then()
    // or await is called on the builder. Chain .then() so the request fires.
    supabase
      .from('trace_logs' as any)
      .insert({
        event,
        step,
        post_id: opts.postId ?? null,
        platform: opts.platform ?? null,
        detail: opts.detail ? JSON.parse(JSON.stringify(opts.detail)) : null,
        error: opts.error ? String(opts.error?.message ?? opts.error) : null,
      })
      .then(() => {}, () => {});
  } catch {
    // swallow
  }
}