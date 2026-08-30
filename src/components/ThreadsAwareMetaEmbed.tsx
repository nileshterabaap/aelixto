import { useEffect, useState } from 'react';
import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
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
  }, [props.url, resolved]);

  if (resolved && buildThreadsEmbedSrc(resolved)) {
    return <ThreadsEmbed {...props} url={resolved} />;
  }

  if (pending) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: 220 }} />;
  }

  return <UniversalMetaEmbed {...(props as any)} />;
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
