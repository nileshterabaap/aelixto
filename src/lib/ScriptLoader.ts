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
export const loadFacebookSDK = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Add fb-root div if it doesn't exist
    if (!document.getElementById('fb-root')) {
      const fbRoot = document.createElement('div');
      fbRoot.id = 'fb-root';
      document.body.appendChild(fbRoot);
    }

    // Load the SDK
    loadScript('https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0')
      .then(() => {
        // Wait for FB object to be available
        const checkFB = setInterval(() => {
          if (window.FB) {
            clearInterval(checkFB);
            resolve();
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkFB);
          if (window.FB) {
            resolve();
          } else {
            reject(new Error('Facebook SDK timeout'));
          }
        }, 10000);
      })
      .catch(reject);
  });
};

// Pinterest embed script loader
export const loadPinterestEmbed = () => loadScript('https://assets.pinterest.com/js/pinit.js');

// Type declarations for global window objects
declare global {
  interface Window {
    FB?: {
      XFBML?: {
        parse: (element?: HTMLElement) => void;
      };
    };
  }
}
