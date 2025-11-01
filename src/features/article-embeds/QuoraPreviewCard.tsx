import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Data = { title: string; image?: string; excerpt?: string; finalUrl: string };

export function QuoraPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [fail, setFail] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;

    (async () => {
      try {
        setLoading(true);
        
        // Use backend edge function to fetch Quora content (bypasses CORS)
        const { data: result, error } = await supabase.functions.invoke('unfurl-article', {
          body: { url }
        });

        if (error || !result) {
          console.error('[QuoraPreviewCard] Error:', error);
          if (!dead) setFail(true);
          return;
        }

        // Extract data from unfurl result
        const title = result.meta?.title || "Quora Post";
        const excerpt = result.meta?.description || "";
        const image = result.meta?.image || undefined;
        const finalUrl = result.resolvedUrl || url;

        if (!dead) {
          setData({ title, image, excerpt, finalUrl });
        }
      } catch (err) {
        console.error('[QuoraPreviewCard] Exception:', err);
        if (!dead) setFail(true);
      } finally {
        if (!dead) setLoading(false);
      }
    })();

    return () => { 
      dead = true; 
    };
  }, [url]);

  if (loading) {
    return <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Loading preview…</div>;
  }

  if (fail || !data) {
    return (
      <div className="rounded-2xl border p-4 text-sm">
        <div className="mb-2">Couldn't load preview.</div>
        <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
          Read on Quora
        </a>
      </div>
    );
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
