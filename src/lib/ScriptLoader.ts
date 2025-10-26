// Utility to load external scripts once per app session
const loadedScripts = new Set<string>();

interface ScriptConfig {
  src: string;
  id: string;
  onLoad?: () => void;
}

export const loadScript = ({ src, id, onLoad }: ScriptConfig): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script already loaded
    if (loadedScripts.has(id)) {
      onLoad?.();
      resolve();
      return;
    }

    // Check if script element already exists
    const existingScript = document.getElementById(id);
    if (existingScript) {
      loadedScripts.add(id);
      onLoad?.();
      resolve();
      return;
    }

    // Create and load new script
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;

    script.onload = () => {
      loadedScripts.add(id);
      onLoad?.();
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`));
    };

    document.body.appendChild(script);
  });
};

// Instagram embed script loader
export const loadInstagramEmbed = (): Promise<void> => {
  return loadScript({
    src: 'https://www.instagram.com/embed.js',
    id: 'instagram-embed-script',
    onLoad: () => {
      // Process embeds after script loads
      if (window.instgrm?.Embeds) {
        window.instgrm.Embeds.process();
      }
    }
  });
};

// Facebook SDK loader
export const loadFacebookSDK = (): Promise<void> => {
  return loadScript({
    src: 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0',
    id: 'facebook-jssdk',
    onLoad: () => {
      // Initialize FB SDK
      if (window.FB) {
        window.FB.init({
          xfbml: true,
          version: 'v19.0'
        });
      }
    }
  });
};

// Type declarations for external scripts
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
    FB?: {
      init: (params: { xfbml: boolean; version: string }) => void;
      XFBML: {
        parse: (element?: HTMLElement) => void;
      };
    };
  }
}
