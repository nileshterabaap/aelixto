import { useEffect } from "react";

interface RedditPostEmbedProps {
  url: string;
  data: {
    meta: {
      title: string;
    };
  };
}

export const RedditPostEmbed = ({ url, data }: RedditPostEmbedProps) => {
  useEffect(() => {
    // Load Reddit embed script if not already loaded
    const existingScript = document.querySelector('script[src="https://embed.redditmedia.com/widgets/platform.js"]');
    
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://embed.redditmedia.com/widgets/platform.js';
      script.async = true;
      script.charset = 'utf-8';
      document.body.appendChild(script);
    } else {
      // If script already exists, trigger embed rendering
      if ((window as any).rembeddit) {
        (window as any).rembeddit.init();
      }
    }
  }, [url]);

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-border bg-card">
      <blockquote 
        className="reddit-embed-bq" 
        data-embed-theme="light"
        data-embed-height="500"
      >
        <a href={url}>
          {data.meta.title || 'View post on Reddit'}
        </a>
      </blockquote>
    </div>
  );
};
