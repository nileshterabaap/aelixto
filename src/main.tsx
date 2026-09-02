import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins } from "./capacitor-init";
import { supabase } from "./integrations/supabase/client";

const unregisterAppServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations.map(async (registration) => {
      const scriptUrl =
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL ||
        "";

      if (scriptUrl.endsWith("/sw-push.js")) return;

      await registration.unregister();
    }),
  );

  if (!("caches" in window)) return;

  const cacheKeys = await window.caches.keys();
  await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
};

// Dismiss splash screen once React is ready
const dismissSplash = () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 300);
  }
};

void unregisterAppServiceWorkers();

createRoot(document.getElementById("root")!).render(<App />);

// Keep the splash screen visible until Supabase has probed the local
// session. Otherwise React commits with `user=null`, `Index` bounces to
// `/auth`, and the user sees a 1-2s flash of the signup form before
// re-navigating home. Hard-cap the wait at 1200ms so a stalled probe never
// leaves the splash stuck.
const dismissSplashAfterSessionProbe = async () => {
  try {
    await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  } catch {
    /* ignore — splash still dismisses below */
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dismissSplash();
      initCapacitorPlugins();
    });
  });
};
void dismissSplashAfterSessionProbe();
