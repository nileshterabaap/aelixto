export type SourceVerdict = "ok" | "removed" | "unknown";

// Login walls, permission errors and unavailable embeds do not prove deletion.
export function instagramResponseVerdict(status: number, finalUrl: string, body: string, official = false): SourceVerdict {
  if (status !== 200 || /\/accounts\/(login|challenge)|\/challenge\//i.test(finalUrl)) return "unknown";
  if (official) {
    try {
      const data = JSON.parse(body);
      return typeof data.html === "string" && /instagram\.com\/(?:p|reel|tv)\//i.test(data.html) ? "ok" : "unknown";
    } catch { return "unknown"; }
  }
  if (/content isn'?t available|Sorry, this page|Page Not Found|may be broken|checkpoint_required|login_required/i.test(body)) return "unknown";
  // Require actual post payload, not a 200 login page or generic Instagram shell.
  return /"shortcode"\s*:\s*"[A-Za-z0-9_-]+"/i.test(body) && /"(?:video_url|display_url|display_resources)"\s*:/i.test(body)
    ? "ok" : "unknown";
}

export async function checkInstagramSource(url: string, meta: string | undefined, request: (url: string, init?: RequestInit) => Promise<Response>): Promise<SourceVerdict> {
  if (meta) {
    try {
      const r = await request(`https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${meta}`);
      const verdict = instagramResponseVerdict(r.status, r.url, await r.text(), true);
      if (verdict === "ok") return verdict;
    } catch { /* Try public post evidence, never infer deletion from an API error. */ }
  }
  try {
    const parsed = new URL(url);
    if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return "unknown";
    const match = parsed.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return "unknown";
    const r = await request(`https://www.instagram.com/${match[1]}/${match[2]}/embed/`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AelixtoBot/1.0; +https://aelixto.com)" } });
    return instagramResponseVerdict(r.status, r.url, await r.text());
  } catch { return "unknown"; }
}

// Shared by both validation entry points. Never remove moderation notices.
export async function clearRestoredSourceAlerts(db: any, post: { id: string; user_id: string }, verdict: SourceVerdict): Promise<number> {
  if (verdict !== "ok") return 0;
  const { data, error } = await db.from("notifications").delete()
    .eq("recipient_id", post.user_id).eq("post_id", post.id)
    .eq("type", "report_outcome").eq("metadata->>kind", "source_removed").select("id");
  if (error) throw error;
  return data?.length ?? 0;
}