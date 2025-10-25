import { useEffect, useState } from 'react';

type ScriptStatus = 'idle' | 'loading' | 'ready' | 'error';

const loadedScripts = new Map<string, ScriptStatus>();
const scriptCallbacks = new Map<string, Array<(status: ScriptStatus) => void>>();

export const useExternalScript = (
  src: string,
  attrs?: Record<string, string>
): { status: ScriptStatus } => {
  const [status, setStatus] = useState<ScriptStatus>(() => {
    return loadedScripts.get(src) || 'idle';
  });

  useEffect(() => {
    if (!src) {
      setStatus('idle');
      return;
    }

    // If already loaded, return immediately
    const currentStatus = loadedScripts.get(src);
    if (currentStatus === 'ready' || currentStatus === 'error') {
      setStatus(currentStatus);
      return;
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      const isLoaded = loadedScripts.get(src) === 'ready';
      if (isLoaded) {
        setStatus('ready');
        loadedScripts.set(src, 'ready');
        return;
      }
    }

    // Subscribe to status changes
    const callbacks = scriptCallbacks.get(src) || [];
    const callback = (newStatus: ScriptStatus) => setStatus(newStatus);
    callbacks.push(callback);
    scriptCallbacks.set(src, callbacks);

    // If already loading, wait for it
    if (currentStatus === 'loading') {
      setStatus('loading');
      return;
    }

    // Start loading
    loadedScripts.set(src, 'loading');
    setStatus('loading');

    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    // Add custom attributes
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        script.setAttribute(key, value);
      });
    }

    const onLoad = () => {
      loadedScripts.set(src, 'ready');
      const cbs = scriptCallbacks.get(src) || [];
      cbs.forEach(cb => cb('ready'));
      scriptCallbacks.delete(src);
    };

    const onError = () => {
      loadedScripts.set(src, 'error');
      const cbs = scriptCallbacks.get(src) || [];
      cbs.forEach(cb => cb('error'));
      scriptCallbacks.delete(src);
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    document.body.appendChild(script);

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      
      // Remove this callback from the list
      const cbs = scriptCallbacks.get(src) || [];
      const index = cbs.indexOf(callback);
      if (index > -1) {
        cbs.splice(index, 1);
      }
    };
  }, [src, JSON.stringify(attrs)]);

  return { status };
};
