import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitorPlugins } from "./capacitor-init";
import { initKeyboardInsets } from "./lib/keyboardInsets";
import { supabase } from "./integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

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

const splashStartedAt = performance.now();

// Dismiss the HTML splash once React and the local session are ready.
const dismissSplash = () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 300);
  }
};

// The Android/iOS launch screen cannot animate. Remove it as soon as React has
// painted so the matching animated HTML splash is visible during startup.
const handOffNativeSplash = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 180 });
  } catch (error) {
    console.warn("SplashScreen plugin not available", error);
  }
};

void unregisterAppServiceWorkers();
initKeyboardInsets();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
  requestAnimationFrame(() => void handOffNativeSplash());
}

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

  // On native, guarantee enough visible time for the animated handoff. The
  // website keeps its existing fast dismissal behavior.
  if (Capacitor.isNativePlatform()) {
    const remaining = Math.max(0, 1000 - (performance.now() - splashStartedAt));
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dismissSplash();
      initCapacitorPlugins();
    });
  });
};
void dismissSplashAfterSessionProbe();
