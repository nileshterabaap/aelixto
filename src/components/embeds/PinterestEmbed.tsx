import { useEffect, useRef, useState } from "react";

interface PinterestEmbedProps {
  url: string;
}

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [fullUrl, setFullUrl] = useState(url);

  // Expand pin.it URLs to full Pinterest URLs
  useEffect(() => {
    const expandUrl = async () => {
      if (url.includes('pin.it')) {
        try {
          const response = await fetch(url, { redirect: 'follow' });
          const expandedUrl = response.url;
          console.log("[PinterestEmbed] Expanded URL:", expandedUrl);
          setFullUrl(expandedUrl);
        } catch (error) {
          console.error("[PinterestEmbed] Failed to expand URL:", error);
          setFullUrl(url);
        }
      }
    };
    expandUrl();
  }, [url]);

  useEffect(() => {
    console.log("[PinterestEmbed] Loading Pinterest embed for URL:", fullUrl);
    
    // Check if Pinterest script already exists
    const existingScript = document.querySelector('script[src="https://assets.pinterest.com/js/pinit.js"]');
    
    if (!existingScript) {
      // Load Pinterest embed script only if it doesn't exist
      const script = document.createElement("script");
      script.src = "https://assets.pinterest.com/js/pinit.js";
      script.async = true;
      script.defer = true;
      scriptRef.current = script;
      document.body.appendChild(script);

      // Process Pinterest embeds after script loads
      script.onload = () => {
        console.log("[PinterestEmbed] Pinterest script loaded successfully");
        if (window.PinUtils) {
          window.PinUtils.build();
          console.log("[PinterestEmbed] Pinterest embeds processed");
        }
      };
    } else {
      // Script already loaded, just build the pins
      console.log("[PinterestEmbed] Pinterest script already loaded, processing embeds");
      if (window.PinUtils) {
        window.PinUtils.build();
        console.log("[PinterestEmbed] Pinterest embeds processed");
      }
    }

    return () => {
      // Only remove the script if this component added it and it's still in the DOM
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        try {
          document.body.removeChild(scriptRef.current);
        } catch (e) {
          // Silently fail if already removed
          console.debug("Pinterest script already removed");
        }
      }
    };
  }, [fullUrl]);

  return (
    <div ref={containerRef} className="pinterest-embed-container w-full flex justify-center">
      <a 
        data-pin-do="embedPin" 
        data-pin-width="large"
        href={fullUrl}
      />
    </div>
  );
};

// Extend window type for Pinterest
declare global {
  interface Window {
    PinUtils?: {
      build: () => void;
    };
  }
}
