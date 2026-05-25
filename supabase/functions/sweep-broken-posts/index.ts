import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Verdict = "ok" | "removed" | "unknown";
const UA = "Mozilla/5.0 (compatible; AelixtoBot/1.0; +https://aelixto.com)";

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

function ytId(u: string): string | null {
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

async function validate(platform: string | null, url: string | null): Promise<Verdict> {
  if (!url) return "unknown";
  const p = (platform || "").toLowerCase();
  const meta = Deno.env.get("META_APP_TOKEN");
  try {
    if (p === "instagram" || /instagram\.com\//i.test(url)) {
      if (!meta) return "unknown";
      const r = await fetchWithTimeout(`https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${meta}`);
      if (r.ok) return "ok";
      if (r.status === 404 || r.status === 400) {
        const text = await r.text();
        if (/not found|unsupported|invalid|removed|unavailable|object/i.test(text)) return "removed";
      }
      return "unknown";
    }
    if (p === "facebook" || /facebook\.com\/|fb\.watch\//i.test(url)) {
      if (!meta) return "unknown";
      const ep = /\/videos?\/|\/reel\/|fb\.watch\//i.test(url) ? "oembed_video" : "oembed_post";
      const r = await fetchWithTimeout(`https://graph.facebook.com/v18.0/${ep}?url=${encodeURIComponent(url)}&access_token=${meta}`);
      if (r.ok) return "ok";
      if (r.status === 404 || r.status === 400) {
        const text = await r.text();
        if (/not found|unsupported|invalid|removed|unavailable|object/i.test(text)) return "removed";
      }
      return "unknown";
    }
    if (p === "youtube" || /youtube\.com\/|youtu\.be\//i.test(url)) {
      const id = ytId(url);
      if (!id) return "unknown";
      const r = await fetchWithTimeout(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      if (r.ok) return "ok";
      if (r.status === 401 || r.status === 404 || r.status === 403) return "removed";
      return "unknown";
    }
    if (p === "tiktok" || /tiktok\.com\//i.test(url)) {
      const r = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (r.ok) return "ok";
      if (r.status === 404) return "removed";
      return "unknown";
    }
    if (p === "reddit" || /reddit\.com\//i.test(url)) {
      const jsonUrl = url.replace(/\/?$/, "") + ".json";
      const r = await fetchWithTimeout(jsonUrl, { headers: { "User-Agent": UA } });
      if (r.status === 404) return "removed";
      if (!r.ok) return "unknown";
      try {
        const j = await r.json();
        const post = j?.[0]?.data?.children?.[0]?.data;
        if (!post) return "removed";
        if (post.removed_by_category || post.removed || post.selftext === "[removed]" || post.selftext === "[deleted]") return "removed";
        return "ok";
      } catch {
        return "unknown";
      }
    }
    if (
      p === "threads" || p === "x" || p === "twitter" || p === "linkedin" ||
      p === "pinterest" || p === "quora" || p === "medium" || p === "article" || p === "external" ||
      /threads\.(net|com)|x\.com|twitter\.com|linkedin\.com|pinterest\.com|pin\.it|quora\.com|medium\.com/i.test(url)
    ) {
      let r = await fetchWithTimeout(url, { method: "HEAD", headers: { "User-Agent": UA } });
      if (r.status === 405 || r.status === 403) {
        r = await fetchWithTimeout(url, { headers: { "User-Agent": UA } });
      }
      if (r.status === 404 || r.status === 410) return "removed";
      return "unknown";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

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