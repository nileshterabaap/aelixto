import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { validate } from "../validate-post-source/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Pick the oldest-validated 60 posts (NULLS FIRST via index) that have a source URL.
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id,user_id,platform,media_url,thumbnail_url,title,content,broken_check_count,broken_first_seen_at,last_validated_at")
    .not("media_url", "is", null)
    .order("last_validated_at", { ascending: true, nullsFirst: true })
    .limit(60);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ok = 0, removed = 0, unknown = 0, deleted = 0;

  for (const post of posts ?? []) {
    const verdict = await validate(post.platform, post.media_url);
    const now = new Date().toISOString();

    if (verdict === "ok") {
      ok++;
      await supabase.from("posts").update({
        last_validated_at: now,
        broken_check_count: 0,
        broken_first_seen_at: null,
      }).eq("id", post.id);
      continue;
    }

    if (verdict === "unknown") {
      unknown++;
      await supabase.from("posts").update({ last_validated_at: now }).eq("id", post.id);
      continue;
    }

    removed++;
    const firstSeen = post.broken_first_seen_at ? new Date(post.broken_first_seen_at).getTime() : 0;
    const gapMs = Date.now() - firstSeen;
    const newCount = (post.broken_check_count ?? 0) + 1;

    if (newCount < 2 || gapMs < 6 * 60 * 60 * 1000) {
      await supabase.from("posts").update({
        last_validated_at: now,
        broken_check_count: newCount,
        broken_first_seen_at: post.broken_first_seen_at ?? now,
      }).eq("id", post.id);
      continue;
    }

    await supabase.from("notifications").insert({
      recipient_id: post.user_id,
      actor_id: post.user_id,
      type: "report_outcome",
      metadata: {
        kind: "source_removed",
        platform: post.platform,
        original_url: post.media_url,
        post_snapshot: {
          title: post.title,
          content: post.content,
          thumbnail_url: post.thumbnail_url,
        },
      },
    });

    await supabase.from("posts").delete().eq("id", post.id);
    deleted++;
  }

  return new Response(JSON.stringify({ scanned: posts?.length ?? 0, ok, removed, unknown, deleted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});