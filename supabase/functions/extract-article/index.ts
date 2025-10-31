// supabase/functions/extract-article/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type ExtractResult = {
  ok: true;
  url: string;
  site: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  images: string[];
};

function pick<T>(arr: T[], pred: (t: T) => boolean): T | null {
  for (const a of arr) if (pred(a)) return a;
  return null;
}

function cleanText(s: string | null): string | null {
  if (!s) return s;
  return s.replace(/\s+/g, " ").trim();
}

function isLikelyLogo(url: string) {
  return /logo|icon|favicon|sprite/i.test(url);
}

function absolute(src: string, base: URL) {
  try { return new URL(src, base).toString(); } catch { return src; }
}

function meta(content: string, name: string) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=[\\"']${name}[\\"'][^>]*?content=[\\"']([^\\"]+)[\\"'][^>]*>`,
    "i",
  );
  const m = content.match(re);
  return m ? m[1] : null;
}

function allImages(html: string) {
  const imgs: string[] = [];
  // src, data-src, srcset first candidate
  const imgTag = /<img[^>]+>/gi;
  const srcAttr = /(?:data-src|data-original|srcset|src)=["']([^"']+)["']/i;
  let m: RegExpExecArray | null;
  while ((m = imgTag.exec(html))) {
    const tag = m[0];
    const s = tag.match(srcAttr)?.[1];
    if (s) {
      // if srcset, split by comma and take first url part
      const first = s.includes(",") ? s.split(",")[0].trim() : s.trim();
      const urlOnly = first.split(" ")[0];
      imgs.push(urlOnly);
    }
  }
  // also look for og:image:alt candidates already added via meta
  return imgs;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const { url } = await req.json().catch(() => ({}));
  if (!url) return new Response("Bad Request", { status: 400 });

  try {
    const target = new URL(url);
    // Quora often blocks default UA; send a real one
    const r = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    const html = await r.text();

    // Basic OG extraction (works for Quora & Spaces)
    const site = meta(html, "og:site_name") || meta(html, "application-name");
    const title = cleanText(meta(html, "og:title") || meta(html, "twitter:title"));
    const description = cleanText(
      meta(html, "og:description") || meta(html, "description") || meta(html, "twitter:description"),
    );
    const ogImage = meta(html, "og:image") || meta(html, "twitter:image");

    // Collect all images and choose a hero:
    const imgs = allImages(html).map((s) => absolute(s, new URL(r.url)));
    const candidates = [
      ...(ogImage ? [absolute(ogImage, new URL(r.url))] : []),
      ...imgs,
    ];
    const image =
      pick(candidates, (u) => !!u && !isLikelyLogo(u) && !u.endsWith(".svg")) ??
      (ogImage ? absolute(ogImage, new URL(r.url)) : null);

    const body: ExtractResult = {
      ok: true,
      url: r.url,
      site: site || "Quora",
      title: title,
      description: description,
      image: image || null,
      images: candidates.slice(0, 10),
    };
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
