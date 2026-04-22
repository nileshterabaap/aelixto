import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins } from "./capacitor-init";

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

// Dismiss splash after a brief delay to ensure first paint
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    dismissSplash();
    initCapacitorPlugins();
  });
});
