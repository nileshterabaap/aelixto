// Feature flag for future Meta oEmbed API integration
export const USE_INSTAGRAM_OEMBED = false;

/**
 * Extract Instagram post ID from URL
 * Supports formats: /p/, /reel/, /tv/
 */
export const extractInstagramPostId = (url: string): string | null => {
  const patterns = [
    /instagram\.com\/p\/([^/?]+)/,
    /instagram\.com\/reel\/([^/?]+)/,
    /instagram\.com\/tv\/([^/?]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

/**
 * Extract Instagram URL from pasted embed code
 */
export const extractInstagramUrlFromEmbed = (embedCode: string): string | null => {
  const match = embedCode.match(/data-instgrm-permalink="([^"]+)"/);
  if (match) return match[1];

  // Also try href attribute
  const hrefMatch = embedCode.match(/href="(https?:\/\/(?:www\.)?instagram\.com\/[^"]+)"/);
  if (hrefMatch) return hrefMatch[1];

  return null;
};

/**
 * Check if the input is Instagram embed code
 */
export const isInstagramEmbedCode = (input: string): boolean => {
  return input.includes('instagram-media') || 
         (input.includes('instagram.com') && input.includes('<blockquote'));
};

/**
 * Load Instagram embed script
 */
export const loadInstagramEmbedScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.instgrm) {
      resolve();
      return;
    }

    // Check if script tag already exists
    const existingScript = document.getElementById('instagram-embed-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', reject);
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.id = 'instagram-embed-script';
    script.src = '//www.instagram.com/embed.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

/**
 * Process Instagram embeds on the page
 */
export const processInstagramEmbeds = () => {
  if (window.instgrm?.Embeds) {
    window.instgrm.Embeds.process();
  }
};

// Type definition for Instagram embed API
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}
