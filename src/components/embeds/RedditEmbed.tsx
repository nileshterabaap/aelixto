import { useEffect, useRef } from "react";

export default function RedditEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const loadRedditEmbed = async () => {
      const src = "https://embed.reddit.com/widgets.js";
      
      // Check if script already exists
      let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      
      if (!script) {
        // Create and append script
        script = document.createElement("script");
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
        
        // Wait for script to load
        await new Promise<void>((resolve) => {
          script!.onload = () => resolve();
        });
      }
      
      // Initialize Reddit embeds
      const reddit = (window as any).reddit;
      if (reddit?.init) {
        reddit.init();
      }
      
      // Force re-render of this specific embed
      if (containerRef.current && reddit?.Embed) {
        const blockquote = containerRef.current.querySelector('blockquote');
        if (blockquote) {
          reddit.Embed.init(blockquote);
        }
      }
    };
    
    loadRedditEmbed();
  }, [url]);
  
  return (
    <div ref={containerRef}>
      <blockquote className="reddit-card" data-card-created="0">
        <a href={url}>View on Reddit</a>
      </blockquote>
    </div>
  );
}
