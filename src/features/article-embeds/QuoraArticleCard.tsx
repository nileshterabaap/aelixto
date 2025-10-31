import { useEffect, useState } from "react";

type Extracted = {
  ok: boolean;
  url: string;
  site?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
};

export function QuoraArticleCard({ url }: { url: string }) {
  const [data, setData] = useState<Extracted | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("extract-article", {
          body: { url },
        });
        if (!cancelled) {
          if (error) throw error;
          setData(data as Extracted);
        }
      } catch {
        setData({ ok: false, url } as any);
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading article…</div>;
  }
  if (!data?.ok) {
    return (
      <div className="rounded-2xl border p-4">
        <p className="text-sm mb-2">Couldn't load preview.</p>
        <a className="text-primary underline" href={url} target="_blank" rel="noreferrer">Read on Quora</a>
      </div>
    );
  }

  const title = data.title || "Quora Post";
  const excerpt = (data.description || "").split(". ").slice(0, 2).join(". ") || "";

  return (
    <article className="rounded-2xl border overflow-hidden">
      {data.image && (
        <img src={data.image} alt="" className="w-full h-auto object-cover aspect-[16/9]" />
      )}
      <div className="p-4">
        <div className="text-xs text-muted-foreground mb-1">{data.site || "Quora"}</div>
        <h3 className="font-semibold text-base leading-snug">{title}</h3>
        {excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{excerpt}</p>}
        <a
          href={data.url || url}
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
