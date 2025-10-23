import { useEffect, useRef } from "react";

interface PinterestEmbedProps {
  url: string;
}

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
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
        if (window.PinUtils) {
          window.PinUtils.build();
        }
      };
    } else {
      // Script already loaded, just build the pins
      if (window.PinUtils) {
        window.PinUtils.build();
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
  }, []);

  return (
    <div ref={containerRef} className="pinterest-embed-container">
      <a 
        data-pin-do="embedPin" 
        data-pin-width="medium"
        href={url}
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
