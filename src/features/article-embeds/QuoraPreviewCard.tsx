import { useEffect, useState } from "react";

type Data = { title: string; image?: string; excerpt?: string; finalUrl: string };
const TIMEOUT_MS = 3000;

// --- URL helpers -------------------------------------------------------------

function isQuora(url: string) {
  try { 
    const hostname = new URL(url).hostname;
    return hostname.includes("quora.com") || hostname === "qr.ae"; 
  } catch { 
    return false; 
  }
}

// Normalize to a canonical, readable Quora URL and strip trackers.
async function normalizeQuoraUrl(raw: string): Promise<string> {
  try {
    const u = new URL(raw);
    // If short link qr.ae, expand once via mirror
    if (u.hostname === "qr.ae") {
      const html = await safeFetchMirrors(raw);
      const canon = extractCanonical(html) || raw;
      return canon;
    }
    // Force https + www host for consistency
    if (u.hostname.endsWith("quora.com")) {
      return `https://www.quora.com${u.pathname}`;
    }
    return raw;
  } catch {
    return raw;
  }
}

function extractCanonical(html: string): string | null {
  const m =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html) ||
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i.exec(html);
  return m?.[1] || null;
}

// --- HTML fetching (CORS-safe via mirrors) -----------------------------------

async function safeFetchMirrors(url: string, signal?: AbortSignal): Promise<string> {
  // r.jina.ai expects a RAW URL after /http/, not encoded
  const raw = (u: string) => `https://r.jina.ai/http/${u}`;
  const u = new URL(url);
  const candidates = [
    raw(`${u.protocol}//${u.host}${u.pathname}${u.search}`),
    raw(`https://${u.host}${u.pathname}${u.search}`),
    raw(`http://${u.host}${u.pathname}${u.search}`),
  ];
  for (const src of candidates) {
    try {
      const res = await fetch(src, { signal, cache: "no-store" });
      if (res.ok) return await res.text();
    } catch {}
  }
  throw new Error("All mirrors failed");
}

// --- Parsers -----------------------------------------------------------------

function extractMeta(html: string) {
  const get = (prop: string) =>
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1];
  const getName = (name: string) =>
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1];
  return {
    title: get("og:title") || get("twitter:title") || getName("title"),
    image: get("og:image") || get("twitter:image"),
    desc: get("og:description") || get("twitter:description") || getName("description"),
  };
}

function absolutize(src: string, base: string) {
  try {
    if (src.startsWith("//")) return `https:${src}`;
    if (src.startsWith("http")) return src;
    return new URL(src, base).toString();
  } catch { 
    return src; 
  }
}

// Extract the first real content image from the HTML body
function extractFirstContentImage(html: string, pageUrl: string): string | undefined {
  // Cut off head to avoid og:image duplication
  const body = html.split("</head>")[1] || html;

  const imgRegex = /<img\s+[^>]*?(src|data-src|data-actualsrc)=["']([^"']+)["'][^>]*>/ig;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(body))) {
    const url = m[2];
    if (!url) continue;
    const abs = absolutize(url, pageUrl);
    // Skip tiny sprites or logos heuristically
    if (/\b(sprite|logo|favicon)\b/i.test(abs)) continue;
    return abs;
  }
  return undefined;
}

function summarize(html: string) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 220);
}

export function QuoraPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [fail, setFail] = useState(false);

  useEffect(() => {
    let dead = false;
    if (!isQuora(url)) { 
      setFail(true); 
      return; 
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    (async () => {
      try {
        // 1) normalize URL so "Read more" is always valid
        const finalUrl = await normalizeQuoraUrl(url);

        // 2) fetch HTML via mirrors
        const html = await safeFetchMirrors(finalUrl, ctrl.signal);

        // 3) extract title/desc via OG tags
        const og = extractMeta(html);
        const title = og.title || "Quora Post";
        const excerpt = og.desc || summarize(html);

        // 4) pick first content image; fallback to og:image
        const contentImg = extractFirstContentImage(html, finalUrl);
        const image = contentImg || (og.image ? absolutize(og.image, finalUrl) : undefined);

        if (!dead) setData({ title, image, excerpt, finalUrl });
      } catch {
        if (!dead) setFail(true);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => { 
      dead = true; 
      ctrl.abort(); 
      clearTimeout(timer); 
    };
  }, [url]);

  if (fail && !data) {
    return (
      <div className="rounded-2xl border p-4 text-sm">
        <div className="mb-2">Couldn't load preview.</div>
        <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
          Read on Quora
        </a>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading preview…</div>;
  }

  return (
    <article className="rounded-2xl border overflow-hidden">
      {data.image && <img src={data.image} alt="" className="w-full h-auto object-cover aspect-[16/9]" />}
      <div className="p-4">
        <div className="text-xs text-muted-foreground mb-1">Quora</div>
        <h3 className="font-semibold text-base leading-snug">{data.title}</h3>
        {data.excerpt && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{data.excerpt}</p>
        )}
        <a
          href={data.finalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-3 text-sm font-medium text-primary underline"
        >
          Read more
        </a>
      </div>
    </article>
  );
}
