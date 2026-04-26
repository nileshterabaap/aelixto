import { Capacitor } from "@capacitor/core";

export async function initCapacitorPlugins() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Ensure the webview does NOT draw under the status bar (so bg color shows)
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
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
}
