interface MediaSuspendOverlayProps {
  visible: boolean;
  thumbnailUrl?: string | null;
}

export function MediaSuspendOverlay({ visible, thumbnailUrl }: MediaSuspendOverlayProps) {
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden bg-muted"
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      ) : (
        <div className="h-full w-full bg-muted" />
      )}
    </div>
  );
}