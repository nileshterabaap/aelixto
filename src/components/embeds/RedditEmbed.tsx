import { useEffect, useRef } from "react";

interface Props { url: string }

export default function RedditEmbed({ url }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load reddit widgets.js once
    const src = "https://embed.reddit.com/widgets.js";
    let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.body.appendChild(script);
      script.onload = () => (window as any).reddit && (window as any).reddit.init?.();
    } else {
      // Already loaded → re-init in case new blockquote was added
      (window as any).reddit && (window as any).reddit.init?.();
    }
  }, [url]);

  return (
    <div ref={ref}>
      <blockquote className="reddit-card">
        <a href={url}>View on Reddit</a>
      </blockquote>
    </div>
  );
}
