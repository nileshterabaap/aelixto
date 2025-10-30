// Utility to load external scripts once per app session
const loadedScripts = new Set<string>();

export const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (loadedScripts.has(src)) {
      resolve();
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      loadedScripts.add(src);
      resolve();
      return;
    }

    // Create and load new script
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};

// Instagram embed script loader
export const loadInstagramEmbed = () => loadScript('https://www.instagram.com/embed.js');

// Facebook embed script loader
export const loadFacebookSDK = () => loadScript('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0');

// Pinterest embed script loader
export const loadPinterestEmbed = () => loadScript('https://assets.pinterest.com/js/pinit.js');

// Reddit embed script loader
export const loadRedditEmbed = () => loadScript('https://embed.reddit.com/widgets.js');
