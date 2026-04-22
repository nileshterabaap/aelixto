import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins } from "./capacitor-init";

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.startsWith("id-preview--") ||
    window.location.hostname.includes("lovable.dev"));

// Dismiss splash screen once React is ready
const dismissSplash = () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 300);
  }
};

// Keep preview uncached so code changes appear immediately,
// while published builds auto-apply updated service workers.
if ("serviceWorker" in navigator) {
  if (isPreviewHost) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  } else {
    const updateSW = registerSW({
      onNeedRefresh() {
        void updateSW(true);
      },
      onOfflineReady() {
        console.log("App ready to work offline");
      },
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

// Dismiss splash after a brief delay to ensure first paint
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    dismissSplash();
    initCapacitorPlugins();
  });
});
