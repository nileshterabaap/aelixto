import { useEffect, useState } from "react";

type Data = { title: string; image?: string; excerpt?: string; finalUrl: string };
const TIMEOUT_MS = 2500;

// Fetch raw HTML via a CORS-friendly proxy (read-only mirror)
async function fetchHtml(url: string, signal?: AbortSignal) {
  const proxied = `https://r.jina.ai/http/${encodeURIComponent(url)}`;
  const res = await fetch(proxied, { signal });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return await res.text();
}

function extractOg(html: string) {
  const get = (prop: string) => {
    const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
    return re.exec(html)?.[1];
  };
  return {
    title: get("og:title") || get("twitter:title"),
    image: get("og:image") || get("twitter:image"),
    desc:  get("og:description") || get("twitter:description"),
  };
}

function summarize(html: string) {
  // crude text fallback: strip tags, compress spaces, take first ~220 chars
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
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    (async () => {
      try {
        const html = await fetchHtml(url, ctrl.signal);
        const og = extractOg(html);
        const title = og.title || "Quora Post";
        const excerpt = og.desc || summarize(html);
        if (!dead) setData({ title, image: og.image, excerpt, finalUrl: url });
      } catch (e: any) {
        if (!dead) setErr(e?.message || "Failed to load");
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => { dead = true; ctrl.abort(); clearTimeout(timer); };
  }, [url]);

  if (err && !data) {
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
    return <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <article className="rounded-2xl border overflow-hidden">
      {data.image && <img src={data.image} alt="" className="w-full h-auto object-cover aspect-[16/9]" />}
      <div className="p-4">
        <div className="text-xs text-muted-foreground mb-1">Quora</div>
        <h3 className="font-semibold text-base leading-snug">{data.title}</h3>
        {data.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{data.excerpt}</p>}
        <a href={data.finalUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-medium text-primary underline">
          Read more
        </a>
      </div>
    </article>
  );
}
