import { UniversalMetaEmbed } from '@/components/UniversalMetaEmbed';
import { ThreadsEmbed, isThreadsUrl, buildThreadsEmbedSrc } from '@/components/embeds/ThreadsEmbed';

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
  if (isThreadsUrl(props.url) && buildThreadsEmbedSrc(props.url)) {
    return <ThreadsEmbed {...props} />;
  }
  return <UniversalMetaEmbed {...(props as any)} />;
};
