import { useState, useEffect } from 'react';

interface YouTubeTitleFallbackProps {
  mediaUrl: string;
  title?: string | null;
}

/**
 * Renders a YouTube video title. If title is null/empty, fetches it live
 * from the YouTube oEmbed API as a self-healing fallback.
 */
export const YouTubeTitleFallback = ({ mediaUrl, title }: YouTubeTitleFallbackProps) => {
  const [fetchedTitle, setFetchedTitle] = useState<string | null>(null);

  useEffect(() => {
    if (title) return; // already have a title

    const videoIdMatch = mediaUrl.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (!videoIdMatch) return;

    const videoId = videoIdMatch[1];
    let cancelled = false;

    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.title) {
          setFetchedTitle(data.title);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [mediaUrl, title]);

  const displayTitle = title || fetchedTitle;
  if (!displayTitle) return null;

  return <h2 className="text-lg font-bold">{displayTitle}</h2>;
};
