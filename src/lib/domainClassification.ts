import { supabase } from "@/integrations/supabase/client";

/** Strip protocol, www, and path → return bare root domain (foo.bar.com). */
export function extractRootDomain(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Read learned classification override for a domain (article | external | null). */
export async function getDomainOverride(
  domain: string | null
): Promise<"article" | "external" | null> {
  if (!domain) return null;
  const { data, error } = await supabase
    .from("domain_classifications" as any)
    .select("content_type")
    .eq("domain", domain)
    .maybeSingle();
  if (error || !data) return null;
  const t = (data as any).content_type;
  return t === "article" || t === "external" ? t : null;
}

/** Record a user correction so future posts from this domain land correctly. */
export async function recordDomainClassification(
  domain: string,
  contentType: "article" | "external"
): Promise<void> {
  await supabase.rpc("record_domain_classification" as any, {
    _domain: domain,
    _content_type: contentType,
  });
}