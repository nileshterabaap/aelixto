import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

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

    // Handle OAuth deep links: com.aelixto.app10://oauth-callback#access_token=...
    App.addListener("appUrlOpen", async ({ url }) => {
      try {
        if (!url) return;
        const lower = url.toLowerCase();
        const isOAuth =
          lower.includes("oauth-callback") ||
          lower.includes("access_token") ||
          lower.includes("code=");

        if (!isOAuth) return;

        // Extract the fragment / query and parse tokens.
        const fragment = url.includes("#") ? url.split("#")[1] : "";
        const query = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
        const params = new URLSearchParams(fragment || query);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        // Close the in-app browser tab if it's still open.
        try {
          const { Browser } = await import("@capacitor/browser");
          await Browser.close();
        } catch {
          /* ignore — tab may already be closed */
        }

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }

        // Land the user on home regardless.
        if (window.location.pathname !== "/") {
          window.location.replace("/");
        }
      } catch (e) {
        console.warn("appUrlOpen handler failed", e);
      }
    });
  } catch (e) {
    console.warn("App plugin not available", e);
  }
}
