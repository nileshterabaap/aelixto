import { useEffect, useState } from "react";

type Data = { title: string; image?: string; excerpt?: string; finalUrl: string };
const TIMEOUT_MS = 3000;

async function fetchWithFallback(url: string, signal?: AbortSignal) {
  const sources = [
    `https://r.jina.ai/http/${encodeURIComponent(url)}`,
    `https://r.jina.ai/http://r.jina.ai/http/${encodeURIComponent(url)}`,
    `https://r.jina.ai/http/https://r.jina.ai/http/${encodeURIComponent(url)}`
  ];
  for (const src of sources) {
    try {
      const res = await fetch(src, { signal });
      if (res.ok) return await res.text();
    } catch {
      continue;
    }
  }
  throw new Error("All mirrors failed");
}

function extractMeta(html: string) {
  const get = (prop: string) => {
    const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
    return re.exec(html)?.[1];
  };
  const getName = (prop: string) => {
    const re = new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
    return re.exec(html)?.[1];
  };
  return {
    title: get("og:title") || get("twitter:title") || getName("title"),
    image: get("og:image") || get("twitter:image"),
    desc: get("og:description") || get("twitter:description") || getName("description"),
  };
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    (async () => {
      try {
        const html = await fetchWithFallback(url, ctrl.signal);
        const og = extractMeta(html);
        const title = og.title || "Quora Post";
        const excerpt = og.desc || summarize(html);
        if (!dead) setData({ title, image: og.image, excerpt, finalUrl: url });
      } catch {
        if (!dead) setFail(true);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => { dead = true; ctrl.abort(); clearTimeout(timer); };
  }, [url]);

  if (fail && !data) {
    return (
      <div className="rounded-2xl border p-4 text-sm">
        <div className="mb-2">Couldn't load preview (Quora blocks automated fetch).</div>
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
