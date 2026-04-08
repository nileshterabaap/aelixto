import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find YouTube posts with null title
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, media_url")
    .eq("platform", "youtube")
    .is("title", null)
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; title: string | null; error?: string }[] = [];

  for (const post of posts || []) {
    if (!post.media_url) continue;

    const videoIdMatch = post.media_url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (!videoIdMatch) {
      results.push({ id: post.id, title: null, error: "no video id" });
      continue;
    }

    const videoId = videoIdMatch[1];
    try {
      const resp = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (!resp.ok) {
        await resp.text();
        results.push({ id: post.id, title: null, error: `oembed ${resp.status}` });
        continue;
      }
      const data = await resp.json();
      if (data.title) {
        const { error: updateError } = await supabase
          .from("posts")
          .update({ title: data.title })
          .eq("id", post.id);

        results.push({
          id: post.id,
          title: data.title,
          error: updateError?.message,
        });
      } else {
        results.push({ id: post.id, title: null, error: "no title in response" });
      }
    } catch (e) {
      results.push({ id: post.id, title: null, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
