// Utility to load external scripts once per app session
const loadedScripts = new Set<string>();
const loadingPromises = new Map<string, Promise<void>>();

export const loadScript = (src: string): Promise<void> => {
  // If already loaded, resolve immediately
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }

  // If currently loading, return existing promise
  if (loadingPromises.has(src)) {
    return loadingPromises.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
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
      loadingPromises.delete(src);
      resolve();
    };
    script.onerror = () => {
      loadingPromises.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.body.appendChild(script);
  });

  loadingPromises.set(src, promise);
  return promise;
};

// Instagram embed script loader
export const loadInstagramEmbed = () => loadScript('https://www.instagram.com/embed.js');

// Facebook embed script loader
export const loadFacebookSDK = (): Promise<void> => {
  const fbSdkUrl = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0';
  
  // If already loaded
  if (loadedScripts.has(fbSdkUrl) && window.FB) {
    return Promise.resolve();
  }
  
  // If currently loading
  if (loadingPromises.has(fbSdkUrl)) {
    return loadingPromises.get(fbSdkUrl)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    // Add fb-root div if it doesn't exist
    if (!document.getElementById('fb-root')) {
      const fbRoot = document.createElement('div');
      fbRoot.id = 'fb-root';
      document.body.appendChild(fbRoot);
    }

    loadScript(fbSdkUrl)
      .then(() => {
        // Wait for FB object to be available
        const checkFB = setInterval(() => {
          if (window.FB) {
            clearInterval(checkFB);
            loadingPromises.delete(fbSdkUrl);
            resolve();
          }
        }, 50);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkFB);
          loadingPromises.delete(fbSdkUrl);
          if (window.FB) {
            resolve();
          } else {
            reject(new Error('Facebook SDK timeout'));
          }
        }, 5000);
      })
      .catch((e) => {
        loadingPromises.delete(fbSdkUrl);
        reject(e);
      });
  });

  loadingPromises.set(fbSdkUrl, promise);
  return promise;
};

// Pinterest embed script loader
export const loadPinterestEmbed = () => loadScript('https://assets.pinterest.com/js/pinit.js');

// Threads embed script loader
export const loadThreadsEmbed = () => loadScript('https://www.threads.net/embed.js');

// Preload all embed SDKs early for faster embed rendering
export const preloadEmbedSDKs = () => {
  // Load in background without blocking
  setTimeout(() => {
    loadInstagramEmbed().catch(() => {});
    loadFacebookSDK().catch(() => {});
  }, 1000);
};

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
