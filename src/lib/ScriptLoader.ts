// Utility to load external scripts once per session
const loadedScripts = new Set<string>();

export const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (loadedScripts.has(src)) {
      resolve();
      return;
    }

    // Check if script already exists in DOM
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
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
