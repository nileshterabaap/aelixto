import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Verdict = "ok" | "removed" | "unknown";
type CheckResult = { verdict: Verdict; author?: string | null };
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

async function resolveRedirect(url: string): Promise<string> {
  try {
    const r = await fetchWithTimeout(url, { method: "GET", headers: { "User-Agent": UA } });
    return r.url || url;
  } catch {
    return url;
  }
}

// Patterns that indicate a removed/deleted/unavailable piece of content.
// Kept conservative — must be specific enough not to match normal pages.
const REMOVED_PATTERNS = [
  /this (post|tweet|video|page|content|pin|story|reel) (is|has been|was)?\s*(no longer )?(available|unavailable|removed|deleted)/i,
  /sorry,?\s+(this|that)\s+(page|post|content|tweet|video|pin)\s+(doesn'?t exist|isn'?t available|cannot be found|is unavailable)/i,
  /page (not found|doesn'?t exist|can'?t be found|unavailable)/i,
  /post (not found|unavailable|has been removed|may have been removed|isn'?t available)/i,
  /content (isn'?t available|is unavailable|has been removed)/i,
  /(404|410)\s*[-–:]?\s*(not found|gone)/i,
  /\bdeleted by (author|user|moderator)\b/i,
  /\[removed by moderator\]/i,
  /this (account|user) (doesn'?t exist|has been suspended|has been deactivated)/i,
  /the link to this (photo|video|post) may be broken/i,
  /hmm\.\.\.this page doesn'?t exist/i,
];

function looksRemoved(html: string): boolean {
  // Trim to a manageable slice — relevant markers live in <head> + first visible chunks.
  const slice = html.length > 200_000 ? html.slice(0, 200_000) : html;
  return REMOVED_PATTERNS.some((re) => re.test(slice));
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i");
  const m = html.match(re);
  if (m?.[1]) return m[1].trim();
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, "i");
  return html.match(re2)?.[1]?.trim() ?? null;
}

function extractAuthor(html: string): string | null {
  // Try common signals in order of reliability.
  const candidates = [
    metaContent(html, "twitter:creator"),
    metaContent(html, "article:author"),
    metaContent(html, "author"),
    metaContent(html, "og:site_name"),
  ];
  for (const c of candidates) {
    if (c && c.length > 0 && c.length < 80) return c.replace(/^@/, "").trim();
  }
  // JSON-LD author.name
  const ld = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i);
  if (ld?.[1]) return ld[1].trim();
  return null;
}

async function tryOembedDiscovery(url: string): Promise<string | null> {
  try {
    const r = await fetchWithTimeout(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/<link[^>]+type=["']application\/json\+oembed["'][^>]+href=["']([^"']+)["']/i);
    if (!m?.[1]) return null;
    const oe = await fetchWithTimeout(m[1].replace(/&amp;/g, "&"), { headers: { "User-Agent": UA } });
    if (!oe.ok) return null;
    const j = await oe.json();
    return j?.author_name ?? null;
  } catch {
    return null;
  }
}

async function checkViaHtml(url: string): Promise<CheckResult> {
  try {
    // Cheap HEAD probe first.
    let head: Response | null = null;
    try {
      head = await fetchWithTimeout(url, { method: "HEAD", headers: { "User-Agent": UA } });
    } catch { /* some hosts reject HEAD */ }
    if (head && (head.status === 404 || head.status === 410)) return { verdict: "removed" };

    const r = await fetchWithTimeout(url, { headers: { "User-Agent": UA } });
    if (r.status === 404 || r.status === 410) return { verdict: "removed" };
    if (!r.ok) return { verdict: "unknown" };
    const html = await r.text();
    if (looksRemoved(html)) return { verdict: "removed", author: extractAuthor(html) };
    return { verdict: "ok", author: extractAuthor(html) };
  } catch {
    return { verdict: "unknown" };
  }
}

async function validate(platform: string | null, url: string | null): Promise<CheckResult> {
  if (!url) return { verdict: "unknown" };
  const p = (platform || "").toLowerCase();
  const meta = Deno.env.get("META_APP_TOKEN");
  try {
    if (p === "instagram" || /instagram\.com\//i.test(url)) {
      if (meta) {
        const r = await fetchWithTimeout(`https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${meta}`);
        if (r.ok) {
          try {
            const j = await r.json();
            return { verdict: "ok", author: j?.author_name ?? null };
          } catch { return { verdict: "ok" }; }
        }
        if (r.status === 404 || r.status === 400) {
          const text = await r.text();
          if (/not found|unsupported|invalid|removed|unavailable|object/i.test(text)) return { verdict: "removed" };
        }
      }
      // Fallback: IG /embed/ endpoint. Removed/private posts render "Sorry, this content isn't available right now".
      const embedUrl = url.replace(/\/?(\?.*)?$/, "/embed/$1");
      const r2 = await fetchWithTimeout(embedUrl, { headers: { "User-Agent": UA } });
      if (r2.ok) {
        const html = await r2.text();
        if (/content isn'?t available|Sorry, this page|Page Not Found|may be broken/i.test(html)) return { verdict: "removed" };
        const m = html.match(/"username":"([^"]+)"/);
        return { verdict: "ok", author: m?.[1] ?? null };
      }
      if (r2.status === 404 || r2.status === 410) return { verdict: "removed" };
      return { verdict: "unknown" };
    }
    if (p === "facebook" || /facebook\.com\/|fb\.watch\//i.test(url)) {
      if (!meta) return { verdict: "unknown" };
      const ep = /\/videos?\/|\/reel\/|fb\.watch\//i.test(url) ? "oembed_video" : "oembed_post";
      const r = await fetchWithTimeout(`https://graph.facebook.com/v18.0/${ep}?url=${encodeURIComponent(url)}&access_token=${meta}`);
      if (r.ok) {
        try { const j = await r.json(); return { verdict: "ok", author: j?.author_name ?? null }; } catch { return { verdict: "ok" }; }
      }
      if (r.status === 404 || r.status === 400) {
        const text = await r.text();
        if (/not found|unsupported|invalid|removed|unavailable|object/i.test(text)) return { verdict: "removed" };
      }
      return { verdict: "unknown" };
    }
    if (p === "youtube" || /youtube\.com\/|youtu\.be\//i.test(url)) {
      const id = ytId(url);
      if (!id) return { verdict: "unknown" };
      const r = await fetchWithTimeout(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
      if (r.ok) {
        try { const j = await r.json(); return { verdict: "ok", author: j?.author_name ?? null }; } catch { return { verdict: "ok" }; }
      }
      if (r.status === 401 || r.status === 404 || r.status === 403) return { verdict: "removed" };
      return { verdict: "unknown" };
    }
    if (p === "tiktok" || /tiktok\.com\//i.test(url)) {
      const r = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (r.ok) {
        try { const j = await r.json(); return { verdict: "ok", author: j?.author_name ?? null }; } catch { return { verdict: "ok" }; }
      }
      if (r.status === 404) return { verdict: "removed" };
      return { verdict: "unknown" };
    }
    if (p === "reddit" || /reddit\.com\//i.test(url)) {
      // Resolve share short links like /r/<sub>/s/<id> to their canonical /comments/... URL.
      let resolved = url;
      if (/reddit\.com\/r\/[^/]+\/s\//i.test(url)) resolved = await resolveRedirect(url);
      const cleanUrl = resolved.split("?")[0].replace(/\/$/, "");
      const jsonUrl = cleanUrl + ".json";
      const r = await fetchWithTimeout(jsonUrl, { headers: { "User-Agent": UA } });
      if (r.status === 404) return { verdict: "removed" };
      if (!r.ok) return { verdict: "unknown" };
      try {
        const j = await r.json();
        const post = j?.[0]?.data?.children?.[0]?.data;
        if (!post) return { verdict: "removed" };
        const author = post.author && post.author !== "[deleted]" ? post.author : null;
        if (post.removed_by_category || post.removed || post.selftext === "[removed]" || post.selftext === "[deleted]" || post.author === "[deleted]") {
          return { verdict: "removed", author };
        }
        return { verdict: "ok", author };
      } catch {
        return { verdict: "unknown" };
      }
    }
    if (
      p === "threads" || p === "x" || p === "twitter" || p === "linkedin" ||
      p === "pinterest" || p === "quora" || p === "medium" || p === "article" || p === "external" ||
      /threads\.(net|com)|x\.com|twitter\.com|linkedin\.com|pinterest\.com|pin\.it|quora\.com|medium\.com/i.test(url)
    ) {
      const res = await checkViaHtml(url);
      if (res.verdict !== "ok" && !res.author) {
        const a = await tryOembedDiscovery(url);
        if (a) return { ...res, author: a };
      }
      return res;
    }
    // Generic catch-all for any other URL — best-effort HTML inspection.
    return await checkViaHtml(url);
  } catch {
    return { verdict: "unknown" };
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
    const result = await validate(post.platform, post.media_url);
    const verdict = result.verdict;
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
    const newCount = (post.broken_check_count ?? 0) + 1;

    // Update tracking — keep the post; the user decides whether to delete it.
    await supabase.from("posts").update({
      last_validated_at: now,
      broken_check_count: newCount,
      broken_first_seen_at: post.broken_first_seen_at ?? now,
    }).eq("id", post.id);

    // Notify on first detection only — avoid spamming on every sweep.
    if (newCount > 1) continue;

    // Belt-and-braces dedupe in case the column was reset.
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("recipient_id", post.user_id)
      .eq("type", "report_outcome")
      .eq("post_id", post.id)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    await supabase.from("notifications").insert({
      recipient_id: post.user_id,
      actor_id: post.user_id,
      type: "report_outcome",
      post_id: post.id,
      metadata: {
        kind: "source_removed",
        platform: post.platform,
        original_url: post.media_url,
        original_author: result.author ?? null,
        post_snapshot: {
          title: post.title,
          content: post.content,
          thumbnail_url: post.thumbnail_url,
          original_author: result.author ?? null,
        },
      },
    });
    deleted++;
  }

  return new Response(JSON.stringify({ scanned: posts?.length ?? 0, ok, removed, unknown, deleted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});