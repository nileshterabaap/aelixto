import { useEffect, useState } from "react";

type Data = { title?: string; image?: string; excerpt?: string; finalUrl: string };
const TIMEOUT_MS = 2500;

export function QuoraPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [fail, setFail] = useState(false);

  useEffect(() => {
    let dead = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    (async () => {
      try {
        // Use r.jina.ai (read-only, CORS-friendly) to get markdown-ish content safely
        const md = await fetch(`https://r.jina.ai/http/${encodeURIComponent(url)}`, { signal: ctrl.signal })
          .then(r => r.text());

        const imgMatch = md.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
        const titleMatch = md.match(/^#\s+(.+)$|^##\s+(.+)$/m);
        const plain = md
          .replace(/!\[[^\]]*\]\((.*?)\)/g, "")
          .replace(/\[(.*?)\]\((.*?)\)/g, "$1");
        const excerpt = plain.split("\n").map(s => s.trim()).filter(Boolean).join(" ").slice(0, 240);

        if (!dead) {
          setData({
            title: (titleMatch?.[1] || titleMatch?.[2] || "Quora Post").trim(),
            image: imgMatch?.[1],
            excerpt,
            finalUrl: url,
          });
        }
      } catch {
        if (!dead) setFail(true);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => { dead = true; ctrl.abort(); clearTimeout(timer); };
  }, [url]);

  if (fail) {
    return (
      <div className="rounded-2xl border p-4">
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
        <h3 className="font-semibold text-base leading-snug">{data.title || "Quora Post"}</h3>
        {data.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{data.excerpt}</p>}
        <a href={data.finalUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-medium text-primary underline">
          Read more
        </a>
      </div>
    </article>
  );
}
