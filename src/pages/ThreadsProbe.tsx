import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * APK-testable probe page (route: /~threads-probe).
 *
 * Three pipelines for the SAME post, now deterministic:
 *   A. current production path — hand-built raw threads.NET /@user/post/id/embed iframe
 *   B. official embed.js blockquote, fed the canonical https://www.threads.com/t/<id> permalink
 *   C. official graph.threads.net/oembed HTML (Meta itself returns the /t/<id> permalink)
 *
 * B and C both retry the embed.js scan until the blockquote is actually
 * replaced by Meta's iframe, so a blank pane means genuine failure, not timing.
 * Nothing here is imported by the feed; the live implementation is untouched.
 */

const DEFAULT_URLS = ['https://www.threads.com/@experianas/post/DcSIa-dAkK3'].join('\n');

const extractShortcode = (url: string): string | null => {
  try {
    const u = new URL(url);
    const post = u.pathname.match(/\/@[^/]+\/post\/([A-Za-z0-9_-]+)/);
    if (post) return post[1];
    const t = u.pathname.match(/^\/t\/([A-Za-z0-9_-]+)/);
    return t ? t[1] : null;
  } catch {
    return null;
  }
};

/** Meta's own canonical embed permalink form. */
const toCanonicalPermalink = (url: string): string | null => {
  const code = extractShortcode(url);
  return code ? `https://www.threads.com/t/${code}` : null;
};

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

const Status = ({ state, detail }: { state: 'pending' | 'ok' | 'fail'; detail: string }) => (
  <p className="p-2 text-[11px] break-all">
    <span
      className={
        state === 'ok'
          ? 'font-semibold text-green-600'
          : state === 'fail'
          ? 'font-semibold text-destructive'
          : 'font-semibold text-muted-foreground'
      }
    >
      {state === 'ok' ? 'RENDERED' : state === 'fail' ? 'FAILED' : 'pending…'}
    </span>{' '}
    <span className="text-muted-foreground">{detail}</span>
  </p>
);

/** Loads Meta's official embed.js once. */
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

let rescanSeq = 0;
/** Re-inject embed.js so it re-scans the DOM for unprocessed blockquotes. */
const triggerRescan = () => {
  const tag = `data-threads-rescan-${rescanSeq++}`;
  const s = document.createElement('script');
  s.src = 'https://www.threads.com/embed.js';
  s.async = true;
  s.setAttribute(tag, '1');
  document.body.appendChild(s);
  window.setTimeout(() => s.remove(), 8000);
};

/**
 * Deterministic processing: poll the container until embed.js has replaced the
 * blockquote with its iframe, re-triggering the scan every 700ms up to ~12s.
 */
const useDeterministicEmbed = (
  ref: React.RefObject<HTMLDivElement>,
  ready: boolean,
  key: string
) => {
  const [state, setState] = useState<'pending' | 'ok' | 'fail'>('pending');
  const [detail, setDetail] = useState('waiting for embed.js');

  useEffect(() => {
    if (!ready) return;
    setState('pending');
    setDetail('scanning…');
    let attempts = 0;
    let done = false;

    const tick = () => {
      if (done) return;
      const el = ref.current;
      const iframe = el?.querySelector('iframe');
      if (iframe) {
        done = true;
        setState('ok');
        setDetail(`iframe after ${attempts} scan(s) · ${(iframe as HTMLIFrameElement).src || 'src pending'}`);
        return;
      }
      if (attempts >= 17) {
        done = true;
        setState('fail');
        setDetail('blockquote never replaced after ~12s of retries');
        return;
      }
      if (attempts % 3 === 0) triggerRescan();
      attempts += 1;
      window.setTimeout(tick, 700);
    };

    const t = window.setTimeout(tick, 100);
    return () => {
      done = true;
      window.clearTimeout(t);
    };
  }, [ready, key, ref]);

  return { state, detail };
};

/** A — current production pipeline: raw threads.net /embed iframe. */
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
      <Status state={loaded ? 'ok' : 'pending'} detail={`threads.net · ${src}`} />
    </div>
  );
};

/** B — official embed.js blockquote, fed the canonical /t/<id> permalink. */
const EmbedJsPane = ({ url }: { url: string }) => {
  const scriptStatus = useThreadsEmbedScript();
  const permalink = toCanonicalPermalink(url);
  const ref = useRef<HTMLDivElement>(null);
  const { state, detail } = useDeterministicEmbed(
    ref,
    scriptStatus === 'loaded' && !!permalink,
    permalink || url
  );

  if (!permalink)
    return <p className="p-3 text-xs text-destructive">Could not extract a Threads shortcode.</p>;

  return (
    <div>
      <div ref={ref} className="min-h-[200px]">
        <blockquote
          key={permalink}
          className="text-post-media"
          data-text-post-permalink={permalink}
          data-text-post-version="0"
          style={{ margin: 0, maxWidth: '100%', width: '100%' }}
        >
          <a href={permalink} target="_blank" rel="noreferrer" className="block p-3 text-xs underline">
            View on Threads
          </a>
        </blockquote>
      </div>
      <Status state={scriptStatus === 'error' ? 'fail' : state} detail={`${permalink} · embed.js:${scriptStatus} · ${detail}`} />
    </div>
  );
};

/** C — official oEmbed HTML from graph.threads.net (via backend). */
const OEmbedPane = ({ url }: { url: string }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [info, setInfo] = useState<string>('loading…');
  const [failed, setFailed] = useState(false);
  const scriptStatus = useThreadsEmbedScript();
  const ref = useRef<HTMLDivElement>(null);
  const { state, detail } = useDeterministicEmbed(ref, !!html && scriptStatus === 'loaded', url);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setFailed(false);
    setInfo('loading…');
    supabase.functions
      .invoke('threads-oembed-probe', { body: { url } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setFailed(true);
          setInfo(`invoke error: ${error.message}`);
          return;
        }
        const d = data as any;
        const oembedHtml = d?.data?.html;
        if (typeof oembedHtml === 'string') {
          // Strip the inert <script> Meta appends — dangerouslySetInnerHTML
          // never executes it, and our own loader handles embed.js.
          setHtml(oembedHtml.replace(/<script[\s\S]*?<\/script>/gi, ''));
          setInfo(`oembed ${d?.status} · token:${d?.hasToken ? 'yes' : 'no'}`);
        } else {
          setFailed(true);
          setInfo(`oembed ${d?.status} · ${JSON.stringify(d?.data)?.slice(0, 200)}`);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setFailed(true);
        setInfo(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div>
      <div ref={ref} className="min-h-[160px]">
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="p-3 text-xs text-muted-foreground">No oEmbed HTML yet.</p>
        )}
      </div>
      <Status
        state={failed || scriptStatus === 'error' ? 'fail' : html ? state : 'pending'}
        detail={`${info} · embed.js:${scriptStatus} · ${detail}`}
      />
    </div>
  );
};

const PostBlock = ({ url, index }: { url: string; index: number }) => (
  <div className="space-y-3 rounded-xl border-2 border-border p-2">
    <h2 className="text-sm font-bold break-all">
      #{index + 1} · {url}
    </h2>
    <Panel title="A · Current production path" note="Hand-built threads.NET /@user/post/id/embed iframe.">
      <RawIframePane url={url} />
    </Panel>
    <Panel title="B · Official embed.js" note="Blockquote fed the canonical threads.com/t/<id> permalink, retried until replaced.">
      <EmbedJsPane url={url} />
    </Panel>
    <Panel title="C · Official oEmbed HTML" note="graph.threads.net/oembed markup (already /t/<id>), retried until replaced.">
      <OEmbedPane url={url} />
    </Panel>
  </div>
);

const ThreadsProbe = () => {
  const [input, setInput] = useState(DEFAULT_URLS);
  const [raw, setRaw] = useState(DEFAULT_URLS);

  const urls = useMemo(
    () =>
      raw
        .split(/\s*\n\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !!extractShortcode(s)),
    [raw]
  );

  return (
    <main className="mx-auto w-full max-w-xl p-3 space-y-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-base font-semibold">Threads embed probe</h1>
        <p className="text-xs text-muted-foreground">
          One URL per line (5–6 video posts). Each renders through three pipelines; B and C retry
          embed.js until Meta replaces the blockquote, so blank = genuine failure.
        </p>
      </header>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setRaw(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder={'https://www.threads.com/@user/post/ABC\nhttps://www.threads.com/@user/post/DEF'}
          className="text-xs"
        />
        <Button type="submit" className="w-full">
          Load {input.split('\n').filter((s) => s.trim()).length} post(s)
        </Button>
      </form>

      {urls.length === 0 && (
        <p className="text-xs text-destructive">No valid Threads post URLs recognised.</p>
      )}

      {urls.map((u, i) => (
        <PostBlock key={u} url={u} index={i} />
      ))}
    </main>
  );
};

export default ThreadsProbe;
