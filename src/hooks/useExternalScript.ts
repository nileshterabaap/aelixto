import { useEffect, useState } from 'react';

type ScriptStatus = 'idle' | 'loading' | 'ready' | 'error';

const loadedScripts = new Map<string, ScriptStatus>();
const scriptCallbacks = new Map<string, Set<(status: ScriptStatus) => void>>();

export const useExternalScript = (
  src: string,
  dataAttributes?: Record<string, string>
): { status: ScriptStatus } => {
  const [status, setStatus] = useState<ScriptStatus>(() => {
    return loadedScripts.get(src) || 'idle';
  });

  useEffect(() => {
    if (!src) {
      setStatus('idle');
      return;
    }

    // If already loaded or errored, return immediately
    const currentStatus = loadedScripts.get(src);
    if (currentStatus === 'ready' || currentStatus === 'error') {
      setStatus(currentStatus);
      return;
    }

    // Subscribe to status changes
    const callback = (newStatus: ScriptStatus) => {
      setStatus(newStatus);
    };
    
    const callbacks = scriptCallbacks.get(src) || new Set();
    callbacks.add(callback);
    scriptCallbacks.set(src, callbacks);

    // If already loading, just subscribe and wait
    if (currentStatus === 'loading') {
      setStatus('loading');
      return () => {
        const cbs = scriptCallbacks.get(src);
        if (cbs) {
          cbs.delete(callback);
          if (cbs.size === 0) {
            scriptCallbacks.delete(src);
          }
        }
      };
    }

    // Check if script already exists in DOM (edge case)
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript && !currentStatus) {
      // Script exists but status unknown - wait for it to load
      loadedScripts.set(src, 'loading');
      setStatus('loading');
      
      const checkExisting = setInterval(() => {
        // Check for SDK availability as proxy for load status
        if (document.readyState === 'complete') {
          clearInterval(checkExisting);
          loadedScripts.set(src, 'ready');
          const cbs = scriptCallbacks.get(src) || new Set();
          cbs.forEach(cb => cb('ready'));
          scriptCallbacks.delete(src);
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkExisting);
      }, 5000);
      
      return () => {
        clearInterval(checkExisting);
        const cbs = scriptCallbacks.get(src);
        if (cbs) {
          cbs.delete(callback);
          if (cbs.size === 0) {
            scriptCallbacks.delete(src);
          }
        }
      };
    }

    // Start loading
    loadedScripts.set(src, 'loading');
    setStatus('loading');

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;

    // Add data attributes
    if (dataAttributes) {
      Object.entries(dataAttributes).forEach(([key, value]) => {
        script.setAttribute(key, value);
      });
    }

    const onLoad = () => {
      loadedScripts.set(src, 'ready');
      const cbs = scriptCallbacks.get(src) || new Set();
      cbs.forEach(cb => {
        try {
          cb('ready');
        } catch (err) {
          console.error('[useExternalScript] Error in callback:', err);
        }
      });
      scriptCallbacks.delete(src);
    };

    const onError = () => {
      loadedScripts.set(src, 'error');
      const cbs = scriptCallbacks.get(src) || new Set();
      cbs.forEach(cb => {
        try {
          cb('error');
        } catch (err) {
          console.error('[useExternalScript] Error in error callback:', err);
        }
      });
      scriptCallbacks.delete(src);
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    document.body.appendChild(script);

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      
      const cbs = scriptCallbacks.get(src);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          scriptCallbacks.delete(src);
        }
      }
    };
  }, [src]);

  return { status };
};
