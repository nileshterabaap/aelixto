import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Dismiss splash screen once React is ready
const dismissSplash = () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 300);
  }
};

// Register service worker with auto-update
registerSW({
  onNeedRefresh() {
    console.log('New content available, refresh to update');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById("root")!).render(<App />);

// Dismiss splash after a brief delay to ensure first paint
requestAnimationFrame(() => {
  requestAnimationFrame(dismissSplash);
});
