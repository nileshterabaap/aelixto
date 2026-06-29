import { useEffect, useRef, useState } from "react";

export default function RedditEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedReady, setEmbedReady] = useState(false);
  
  useEffect(() => {
    setEmbedReady(false);

    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      setEmbedReady(true);
    };

    const checkReady = () => {
      const container = containerRef.current;
      if (!container) return false;

      const iframe = container.querySelector('iframe');
      const pendingBlockquote = container.querySelector('blockquote.reddit-card[data-card-created="0"]');
      const processedBlockquote = container.querySelector('blockquote.reddit-card:not([data-card-created="0"])');
      const hasRenderedChildren = Array.from(container.childNodes).some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (pendingBlockquote && node === pendingBlockquote) {
          return node.childElementCount > 1;
        }
        return true;
      });

      if (iframe || processedBlockquote || hasRenderedChildren) {
        markReady();
        return true;
      }

      return false;
    };

    const observer = new MutationObserver(() => {
      checkReady();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-card-created', 'class', 'style'],
      });
    }

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

      requestAnimationFrame(() => {
        checkReady();
      });
    };
    
    loadRedditEmbed();

    const fallbackTimer = setTimeout(() => {
      markReady();
    }, 8000);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(fallbackTimer);
    };
  }, [url]);
  
  return (
    <div ref={containerRef} data-embed-status={embedReady ? 'ready' : 'loading'}>
      <blockquote className="reddit-card" data-card-created="0">
        <a href={url}>View on Reddit</a>
      </blockquote>
    </div>
  );
}
