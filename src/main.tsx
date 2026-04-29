import { createRoot } from "react-dom/client";
import { registerSW } from 'virtual:pwa-register';
import App from "./App.tsx";
import "./index.css";

// Register service worker with auto-update
registerSW({
  onNeedRefresh() {
    // New content available, will auto-update on next visit
    console.log('New content available, refresh to update');
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

createRoot(document.getElementById("root")!).render(<App />);
