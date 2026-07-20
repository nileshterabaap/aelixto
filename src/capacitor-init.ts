import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { initAdsAndConsent } from "@/lib/adConsent";

export async function initCapacitorPlugins() {
  if (!Capacitor.isNativePlatform()) return;

  const openNativeExternal = async (url: string) => {
    try {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      await AppLauncher.openUrl({ url });
    } catch (e) {
      console.warn("External app launch failed", e);
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url, presentationStyle: "fullscreen" });
      } catch (browserError) {
        console.warn("External browser fallback failed", browserError);
      }
    }
  };

  const originalWindowOpen = window.open.bind(window);
  // Hosts of embedded content whose in-iframe popups (LinkedIn video player,
  // Facebook lightboxes, IG image viewer, etc.) MUST NOT be redirected to the
  // native app — otherwise tapping "Play" inside these embeds kicks the user
  // out of Aelixto. Only user-initiated <a target="_blank"> and openExternalUrl
  // calls should reach the native browser/app.
  const EMBED_HOSTS = [
    "linkedin.com",
    "www.linkedin.com",
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "instagram.com",
    "www.instagram.com",
    "tiktok.com",
    "www.tiktok.com",
    "twitter.com",
    "x.com",
    "threads.net",
    "threads.com",
  ];
  const isEmbedHost = (host: string) => EMBED_HOSTS.some((h) => host === h || host.endsWith("." + h));

  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url) {
      try {
        const next = new URL(String(url), window.location.href);
        if (
          (next.protocol === "http:" || next.protocol === "https:") &&
          next.origin !== window.location.origin &&
          !isEmbedHost(next.hostname)
        ) {
          void openNativeExternal(next.href);
          return null;
        }
      } catch {
        // Fall back to the browser's default handling below.
      }
    }
    return originalWindowOpen(url as string | undefined, target, features);
  }) as typeof window.open;

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor?.href) return;

      try {
        const next = new URL(anchor.href, window.location.href);
        if ((next.protocol === "http:" || next.protocol === "https:") && next.origin !== window.location.origin) {
          event.preventDefault();
          event.stopPropagation();
          void openNativeExternal(next.href);
        }
      } catch {
        // Ignore malformed hrefs and let the WebView handle them.
      }
    },
    true,
  );

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Webview should NOT draw under the status bar — the OS reserves that space
    // and paints it with our backgroundColor below. This avoids the giant gap
    // we'd otherwise need to compensate for in CSS via env(safe-area-inset-top).
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Style.Light = light status-bar (white bg) with DARK icons/text.
    // (Capacitor's naming is the opposite of what you'd expect — Style.Dark
    // actually produces a dark bar with light icons.)
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

        // Extract the fragment / query and parse tokens. Chrome intent links
        // can deliver the former hash payload as query params, so support both.
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

  // Register for native push notifications (FCM on Android, APNs on iOS).
  // IMPORTANT: this MUST run fully detached from the startup await chain.
  // If FCM isn't configured or is slow, `PushNotifications.register()` can
  // block the WebView boot after the user grants the permission — which
  // manifests as "app stuck / won't open on grant, works on deny".
  // We fire-and-forget on a later tick, and hard-timeout every call.
  const initPushDetached = () => {
    setTimeout(async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const saveToken = async (token: string) => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
            await supabase.from("device_tokens").upsert(
              { user_id: user.id, token, platform, bundle_id: "com.aelixto.app10" },
              { onConflict: "user_id,token" },
            );
          } catch (e) {
            console.warn("device_tokens upsert failed", e);
          }
        };

        PushNotifications.addListener("registration", (t) => { void saveToken(t.value); });
        PushNotifications.addListener("registrationError", (err) => {
          console.warn("Push registration error", err);
        });

        const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
          Promise.race([
            p.catch((e) => { console.warn("push call failed", e); return null as T | null; }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
          ]);

        const register = async () => {
          try {
            const perm = await withTimeout(PushNotifications.checkPermissions(), 3000);
            let granted = perm?.receive === "granted";
            if (!granted && perm && perm.receive !== "denied") {
              const req = await withTimeout(PushNotifications.requestPermissions(), 60000);
              granted = req?.receive === "granted";
            }
            if (granted) {
              // Never await — register() can hang indefinitely if FCM isn't
              // reachable. The `registration` event listener above handles
              // the token whenever/if it arrives.
              void withTimeout(PushNotifications.register(), 15000);
            }
          } catch (e) {
            console.warn("push register wrapper failed", e);
          }
        };

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) void register();
        supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_IN") void register();
        });
      } catch (e) {
        console.warn("PushNotifications plugin not available", e);
      }
    }, 2000);
  };
  initPushDetached();

  // Fire-and-forget: consent + Google Mobile Ads SDK init. Runs after boot
  // so it never blocks first paint. Ads only ever render inside the feed
  // once this resolves AND install age is >= 48h AND the user is signed in.
  setTimeout(() => {
    void initAdsAndConsent();
  }, 3000);
}
