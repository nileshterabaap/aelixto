import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * APK-testable probe page (route: /~threads-probe).
 *
 * Renders the SAME Threads post through three independent pipelines so the
 * black-cover failure can be attributed precisely inside a real APK build:
 *   A. current production path — hand-built raw /embed iframe
 *   B. Meta's official embed.js blockquote pipeline (no token needed)
 *   C. Meta's official graph.threads.net oEmbed HTML (token via backend)
 *
 * Nothing here is imported by the feed; the live implementation is untouched.
 */

const DEFAULT_URL = 'https://www.threads.com/@zuck/post/C8Vd1234abc';

const buildRawEmbedSrc = (url: string): string | null => {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/@([^/]+)\/post\/([A-Za-z0-9_-]+)/);
    return m ? `https://www.threads.net/@${m[1]}/post/${m[2]}/embed` : null;
  } catch {
    return null;
  }
};

const Panel = ({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-lg border border-border p-3 space-y-2">
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
    <div className="rounded-md bg-muted/30 overflow-hidden">{children}</div>
  </section>
);

/** A — current production pipeline: raw /embed iframe. */
const RawIframePane = ({ url }: { url: string }) => {
  const src = buildRawEmbedSrc(url);
  const [loaded, setLoaded] = useState(false);
  if (!src) return <p className="p-3 text-xs text-destructive">Not a canonical Threads post URL.</p>;
  return (
    <div>
      <iframe
        src={src}
        title="threads-raw-embed"
        scrolling="no"
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        onLoad={() => setLoaded(true)}
        style={{ border: 'none', width: '100%', height: 480, display: 'block' }}
      />
      <p className="p-2 text-[11px] text-muted-foreground break-all">
        src: {src} — iframe onLoad: {String(loaded)}
      </p>
    </div>
  );
};

/** Loads Meta's official embed.js once and re-processes on demand. */
const useThreadsEmbedScript = () => {
  const [status, setStatus] = useState<'idle' | 'loaded' | 'error'>('idle');
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-threads-embed]');
    if (existing) {
      setStatus('loaded');
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://www.threads.com/embed.js';
    s.async = true;
    s.setAttribute('data-threads-embed', '1');
    s.onload = () => setStatus('loaded');
    s.onerror = () => setStatus('error');
    document.body.appendChild(s);
  }, []);
  return status;
};

const reprocessEmbeds = () => {
  const w = window as any;
  try {
    w.instgrm?.Embeds?.process?.();
  } catch {
    /* ignore */
  }
  // Threads' embed.js re-scans when re-injected.
  const old = document.querySelector('script[data-threads-embed-repro]');
  old?.remove();
  const s = document.createElement('script');
  s.src = 'https://www.threads.com/embed.js';
  s.async = true;
  s.setAttribute('data-threads-embed-repro', '1');
  document.body.appendChild(s);
};

/** B — official embed.js blockquote pipeline. */
const EmbedJsPane = ({ url }: { url: string }) => {
  const status = useThreadsEmbedScript();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== 'loaded') return;
    const t = window.setTimeout(reprocessEmbeds, 60);
    return () => window.clearTimeout(t);
  }, [status, url]);

  return (
    <div ref={ref} className="min-h-[240px]">
      <blockquote
        className="text-post-media"
        data-text-post-permalink={url}
        data-text-post-version="0"
        style={{ margin: 0, maxWidth: '100%', width: '100%' }}
      >
        <a href={url} target="_blank" rel="noreferrer" className="block p-3 text-xs underline">
          View on Threads
        </a>
      </blockquote>
      <p className="p-2 text-[11px] text-muted-foreground">embed.js: {status}</p>
    </div>
  );
};

/** C — official oEmbed HTML from graph.threads.net (via backend). */
const OEmbedPane = ({ url }: { url: string }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [info, setInfo] = useState<string>('loading…');
  const status = useThreadsEmbedScript();

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setInfo('loading…');
    supabase.functions
      .invoke('threads-oembed-probe', { body: { url } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setInfo(`invoke error: ${error.message}`);
          return;
        }
        const d = data as any;
        const oembedHtml = d?.data?.html;
        setInfo(
          `status ${d?.status} · token:${d?.hasToken ? 'yes' : 'no'} · ${
            oembedHtml ? 'html received' : JSON.stringify(d?.data)?.slice(0, 300)
          }`
        );
        if (typeof oembedHtml === 'string') setHtml(oembedHtml);
      })
      .catch((e) => !cancelled && setInfo(String(e)));
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!html || status !== 'loaded') return;
    const t = window.setTimeout(reprocessEmbeds, 60);
    return () => window.clearTimeout(t);
  }, [html, status]);

  return (
    <div className="min-h-[160px]">
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="p-3 text-xs text-muted-foreground">No oEmbed HTML yet.</p>
      )}
      <p className="p-2 text-[11px] text-muted-foreground break-all">{info}</p>
    </div>
  );
};

const ThreadsProbe = () => {
  const [input, setInput] = useState(DEFAULT_URL);
  const [url, setUrl] = useState(DEFAULT_URL);

  return (
    <main className="mx-auto w-full max-w-xl p-3 space-y-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-base font-semibold">Threads embed probe</h1>
        <p className="text-xs text-muted-foreground">
          Same post, three pipelines. Compare in the APK vs Chrome.
        </p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setUrl(input.trim());
        }}
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Threads post URL" />
        <Button type="submit">Load</Button>
      </form>

      <Panel title="A · Current production path" note="Hand-built raw /embed iframe (unchanged code path).">
        <RawIframePane url={url} />
      </Panel>

      <Panel title="B · Official embed.js" note="Meta blockquote + www.threads.com/embed.js, no token.">
        <EmbedJsPane url={url} />
      </Panel>

      <Panel title="C · Official oEmbed HTML" note="graph.threads.net/oembed via backend, rendered + processed.">
        <OEmbedPane url={url} />
      </Panel>
    </main>
  );
};

export default ThreadsProbe;
