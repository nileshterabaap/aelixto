import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Verdict = "ok" | "removed" | "unknown";

const UA =
  "Mozilla/5.0 (compatible; AelixtoBot/1.0; +https://aelixto.com)";

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
  const m = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m?.[1] ?? null;
}

export async function validate(platform: string | null, url: string | null): Promise<Verdict> {
  if (!url) return "unknown";
  const p = (platform || "").toLowerCase();
  const meta = Deno.env.get("META_APP_TOKEN");

  try {
    // ===== Instagram =====
    if (p === "instagram" || /instagram\.com\//i.test(url)) {
      if (!meta) return "unknown";
      const r = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${meta}`
      );
      if (r.ok) return "ok";
      if (r.status === 404 || r.status === 400) {
        // 400 with subcode 2207006/24 = media not found
        const text = await r.text();
        if (/not found|unsupported|invalid|removed|unavailable|object/i.test(text)) return "removed";
        return "unknown";
      }
      return "unknown";
    }

    // ===== Facebook =====
    if (p === "facebook" || /facebook\.com\/|fb\.watch\//i.test(url)) {
      if (!meta) return "unknown";
      const ep = /\/videos?\/|\/reel\/|fb\.watch\//i.test(url)
        ? "oembed_video"
        : "oembed_post";
      const r = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${ep}?url=${encodeURIComponent(url)}&access_token=${meta}`
      );
      if (r.ok) return "ok";
      if (r.status === 404 || r.status === 400) {
        const text = await r.text();
        if (/not found|unsupported|invalid|removed|unavailable|object/i.test(text)) return "removed";
      }
      return "unknown";
    }

    // ===== YouTube =====
    if (p === "youtube" || /youtube\.com\/|youtu\.be\//i.test(url)) {
      const id = ytId(url);
      if (!id) return "unknown";
      const r = await fetchWithTimeout(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
      );
      if (r.ok) return "ok";
      if (r.status === 401 || r.status === 404 || r.status === 403) return "removed";
      return "unknown";
    }

    // ===== TikTok =====
    if (p === "tiktok" || /tiktok\.com\//i.test(url)) {
      const r = await fetchWithTimeout(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
      );
      if (r.ok) return "ok";
      if (r.status === 404) return "removed";
      return "unknown";
    }

    // ===== Reddit =====
    if (p === "reddit" || /reddit\.com\//i.test(url)) {
      const jsonUrl = url.replace(/\/?$/, "") + ".json";
      const r = await fetchWithTimeout(jsonUrl, { headers: { "User-Agent": UA } });
      if (r.status === 404) return "removed";
      if (!r.ok) return "unknown";
      try {
        const j = await r.json();
        const post = j?.[0]?.data?.children?.[0]?.data;
        if (!post) return "removed";
        if (post.removed_by_category || post.removed || post.selftext === "[removed]" || post.selftext === "[deleted]") {
          return "removed";
        }
        return "ok";
      } catch {
        return "unknown";
      }
    }

    // ===== Generic (Threads, X, LinkedIn, Pinterest, Quora, articles) =====
    if (
      p === "threads" || p === "x" || p === "twitter" || p === "linkedin" ||
      p === "pinterest" || p === "quora" || p === "medium" || p === "article" || p === "external" ||
      /threads\.(net|com)|x\.com|twitter\.com|linkedin\.com|pinterest\.com|pin\.it|quora\.com|medium\.com/i.test(url)
    ) {
      // HEAD first; some hosts disallow HEAD so fall back to GET on 405
      let r = await fetchWithTimeout(url, { method: "HEAD", headers: { "User-Agent": UA } });
      if (r.status === 405 || r.status === 403) {
        r = await fetchWithTimeout(url, { headers: { "User-Agent": UA } });
      }
      if (r.status === 404 || r.status === 410) return "removed";
      return "unknown"; // 200 doesn't guarantee the post still exists (most platforms redirect to a "not found" page with 200)
    }

    return "unknown";
  } catch (_e) {
    return "unknown";
  }
}

export async function processPost(
  supabase: ReturnType<typeof createClient>,
  post: { id: string; user_id: string; platform: string | null; media_url: string | null; thumbnail_url: string | null; title: string | null; content: string | null; broken_check_count: number; broken_first_seen_at: string | null }
): Promise<{ verdict: Verdict; deleted: boolean }> {
  const verdict = await validate(post.platform, post.media_url);
  const now = new Date().toISOString();

  if (verdict === "ok") {
    await supabase.from("posts").update({
      last_validated_at: now,
      broken_check_count: 0,
      broken_first_seen_at: null,
    }).eq("id", post.id);
    return { verdict, deleted: false };
  }

  if (verdict === "unknown") {
    await supabase.from("posts").update({ last_validated_at: now }).eq("id", post.id);
    return { verdict, deleted: false };
  }

  // verdict === "removed" — 2-strike gate with 6h minimum gap
  const firstSeen = post.broken_first_seen_at ? new Date(post.broken_first_seen_at).getTime() : 0;
  const gapMs = Date.now() - firstSeen;
  const newCount = post.broken_check_count + 1;

  if (newCount < 2 || gapMs < 6 * 60 * 60 * 1000) {
    await supabase.from("posts").update({
      last_validated_at: now,
      broken_check_count: newCount,
      broken_first_seen_at: post.broken_first_seen_at ?? now,
    }).eq("id", post.id);
    return { verdict, deleted: false };
  }

  // Confirmed removed — notify author and delete the post
  await supabase.from("notifications").insert({
    recipient_id: post.user_id,
    actor_id: post.user_id, // notifications.actor_id is NOT NULL; self-actor is fine for system notices
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
  return { verdict, deleted: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const { postId, url, platform } = body || {};

    // Ad-hoc check mode: validate any URL without touching the database.
    // Used during post creation to detect private/removed sources.
    if (!postId && typeof url === "string" && url.trim().length > 0) {
      const verdict = await validate(platform ?? null, url);
      return new Response(JSON.stringify({ verdict }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!postId || typeof postId !== "string") {
      return new Response(JSON.stringify({ error: "postId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: post, error } = await supabase
      .from("posts")
      .select("id,user_id,platform,media_url,thumbnail_url,title,content,broken_check_count,broken_first_seen_at")
      .eq("id", postId)
      .maybeSingle();

    if (error || !post) {
      return new Response(JSON.stringify({ error: "post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await processPost(supabase, post as any);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});