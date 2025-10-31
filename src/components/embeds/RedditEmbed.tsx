import { useEffect } from "react";

export default function RedditEmbed({ url }: { url: string }) {
  useEffect(() => {
    const src = "https://embed.reddit.com/widgets.js";
    let s = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = src; 
      s.async = true;
      document.body.appendChild(s);
      s.onload = () => (window as any).reddit?.init?.();
    } else {
      (window as any).reddit?.init?.();
    }
  }, [url]);
  
  return (
    <blockquote className="reddit-card">
      <a href={url}>View on Reddit</a>
    </blockquote>
  );
}
