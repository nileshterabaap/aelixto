export function QuoraPreviewCard({ url }: { url: string }) {
  // Extract title from URL (last part of path, replace dashes with spaces)
  const getTitle = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1] || 'Quora Post';
      return lastPart
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    } catch {
      return 'Quora Post';
    }
  };

  const title = getTitle(url);

  return (
    <article className="rounded-2xl border overflow-hidden">
      <div className="p-4">
        <div className="text-xs text-muted-foreground mb-1">Quora</div>
        <h3 className="font-semibold text-base leading-snug line-clamp-2">{title}</h3>
        <a
          href={url}
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
