import { Capacitor } from "@capacitor/core";

export async function initCapacitorPlugins() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Ensure the webview does NOT draw under the status bar (so bg color shows)
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Style.Dark = dark icons (for light/white backgrounds)
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#FFFFFF" });
  } catch (e) {
    console.warn("StatusBar plugin not available", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    // Auto-hide is configured, but we can also manually hide after app loads
    await SplashScreen.hide();
  } catch (e) {
    console.warn("SplashScreen plugin not available", e);
  }

  // Wire Android hardware back button to React Router history.
  // Default behavior exits the app from any screen — instead, navigate back
  // through history and only exit when there's nowhere left to go.
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch (e) {
    console.warn("App plugin not available", e);
  }
}
