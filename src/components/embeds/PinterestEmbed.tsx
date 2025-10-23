import { useEffect, useRef } from "react";

interface PinterestEmbedProps {
  url: string;
}

export const PinterestEmbed = ({ url }: PinterestEmbedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Pinterest embed script
    const script = document.createElement("script");
    script.src = "https://assets.pinterest.com/js/pinit.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    // Process Pinterest embeds after script loads
    script.onload = () => {
      if (window.PinUtils) {
        window.PinUtils.build();
      }
    };

    return () => {
      document.body.removeChild(script);
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
