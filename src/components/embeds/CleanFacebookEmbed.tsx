import React, { useMemo } from "react";

export function CleanFacebookEmbed({ html }: { html: string }) {
  // Move the iframe up a bit and hide overflow so the extra FB chrome is out of view.
  // Tuned for Reels/Post embeds and mobile; adjustable with CSS variables.
  const cleaned = useMemo(() => html, [html]);

  return (
    <div className="fb-trim-container">
      {/* eslint-disable-next-line react/no-danger */}
      <div className="fb-trim-inner" dangerouslySetInnerHTML={{ __html: cleaned }} />
    </div>
  );
}
