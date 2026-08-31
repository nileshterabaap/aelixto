import { useEffect, useState } from 'react';
import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
import { OgCardFallback } from '@/components/OgCardFallback';
import { ThreadsEmbed, isThreadsUrl, buildThreadsEmbedSrc } from '@/components/embeds/ThreadsEmbed';
import {
  isThreadsShareUrl,
  getCachedThreadsShareUrl,
  resolveThreadsShareUrl,
} from '@/lib/resolveThreadsShareUrl';

/**
 * Resolves /share/... Threads links through the expand-url edge function and
 * renders the canonical embed once the canonical URL is known.
 */
const ThreadsShareResolver = (props: {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  const [resolved, setResolved] = useState<string | null>(() =>
    getCachedThreadsShareUrl(props.url)
  );
  const [pending, setPending] = useState(!resolved);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (resolved) return;
    let cancelled = false;
    setPending(true);
    resolveThreadsShareUrl(props.url)
      .then((next) => {
        if (cancelled) return;
        if (next) setResolved(next);
        setPending(false);
      })
      .catch(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.url, resolved, attempt]);

  // Fix 3 — a failed resolution is transient (cold start / timeout / network),
  // so retry once shortly after instead of falling through to a cached
  // fallback. Nothing is persisted, so the URL stays eligible on every mount.
  useEffect(() => {
    if (resolved || pending || attempt >= 1) return;
    const timer = window.setTimeout(() => setAttempt((n) => n + 1), 2500);
    return () => window.clearTimeout(timer);
  }, [resolved, pending, attempt]);

  if (resolved && buildThreadsEmbedSrc(resolved)) {
    return <ThreadsEmbed {...props} url={resolved} />;
  }

  if (pending) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: 220 }} />;
  }

  // Never hand an unresolved /share/... URL to UniversalMetaEmbed: it would
  // write a permanent `showFallback` entry into its module-level embedCache.
  // Render the link card directly instead — no cache write, fully retryable.
  return <OgCardFallback url={props.url} platform="Threads" />;
};

/**
 * Drop-in replacement for UniversalMetaEmbed that renders Threads posts with
 * the dedicated Threads renderer (visibility-gated load + one retry) and
 * leaves every other platform on the guarded UniversalMetaEmbed path.
 */
export const ThreadsAwareMetaEmbed = (props: {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  if (isThreadsShareUrl(props.url)) {
    return <ThreadsShareResolver {...props} />;
  }
  if (isThreadsUrl(props.url) && buildThreadsEmbedSrc(props.url)) {
    return <ThreadsEmbed {...props} />;
  }
  return <UniversalMetaEmbed {...(props as any)} />;
};
