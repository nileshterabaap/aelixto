import { useEffect, useState } from 'react';
import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
import { ThreadsEmbed, isThreadsUrl, buildThreadsEmbedSrc } from '@/components/embeds/ThreadsEmbed';
import {
  getCachedThreadsShareUrl,
  isThreadsShareUrl,
  resolveThreadsShareUrl,
} from '@/lib/resolveThreadsShareUrl';

/**
 * Drop-in replacement for UniversalMetaEmbed that renders Threads posts with
 * the dedicated Threads renderer (visibility-gated load + one retry) and
 * leaves every other platform on the guarded UniversalMetaEmbed path.
 */
const ThreadsShareResolver = (props: {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  const [resolved, setResolved] = useState<string | null>(() =>
    getCachedThreadsShareUrl(props.url),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (resolved) return;
    let cancelled = false;
    resolveThreadsShareUrl(props.url).then((finalUrl) => {
      if (cancelled) return;
      if (finalUrl) setResolved(finalUrl);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [props.url, resolved]);

  if (resolved && buildThreadsEmbedSrc(resolved)) {
    return <ThreadsEmbed {...props} url={resolved} />;
  }

  // Only hand a share link to the generic path once resolution definitively
  // failed; while pending, keep the parent skeleton instead of flashing a card.
  if (!failed) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: 1 }} />;
  }

  return <UniversalMetaEmbed {...(props as any)} />;
};

export const ThreadsAwareMetaEmbed = (props: {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  if (isThreadsUrl(props.url) && buildThreadsEmbedSrc(props.url)) {
    return <ThreadsEmbed {...props} />;
  }
  if (isThreadsShareUrl(props.url)) {
    return <ThreadsShareResolver {...props} />;
  }
  return <UniversalMetaEmbed {...(props as any)} />;
};
