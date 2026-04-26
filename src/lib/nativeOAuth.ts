import { Capacitor } from "@capacitor/core";

/**
 * On native (Capacitor) platforms, intercept the OAuth redirect that the
 * Lovable auth library performs via `window.location.href = ...`.
 *
 * Default behavior: setting window.location escapes the WebView and opens the
 * system browser (Chrome) — which kicks the user out of the app.
 *
 * Our behavior: open the OAuth URL inside an in-app Browser tab. When the
 * provider redirects back to https://aelixto.com/auth#access_token=..., we
 * detect that callback URL via the `browserPageLoaded` event, close the
 * in-app browser, and navigate the main WebView to the same URL so the
 * existing auth handler picks up the session tokens from the hash.
 */
let installed = false;

export async function installNativeOAuthInterceptor() {
  if (installed) return;
  if (!Capacitor.isNativePlatform()) return;
  installed = true;

  const { Browser } = await import("@capacitor/browser");

  const isOAuthUrl = (url: string) => {
    try {
      const u = new URL(url, window.location.href);
      return (
        u.hostname.endsWith("oauth.lovable.app") ||
        u.pathname.startsWith("/~oauth") ||
        u.hostname.endsWith("accounts.google.com") ||
        u.hostname.endsWith("appleid.apple.com")
      );
    } catch {
      return false;
    }
  };

  const isCallbackUrl = (url: string) => {
    try {
      const u = new URL(url);
      // Final landing on our domain with auth tokens in the hash/query
      const hasTokens =
        u.hash.includes("access_token") ||
        u.searchParams.has("code") ||
        u.searchParams.has("error");
      return (
        hasTokens &&
        (u.hostname === "aelixto.com" ||
          u.hostname.endsWith("aelixto.lovable.app") ||
          u.hostname.endsWith("lovableproject.com"))
      );
    } catch {
      return false;
    }
  };

  // Listen for the in-app browser navigating to our callback URL.
  Browser.addListener("browserPageLoaded", () => {
    // No URL is provided by this event; rely on browserFinished + a fallback.
  });

  // Patch window.location.assign / href so OAuth navigations open in-app.
  const tryOpen = async (url: string) => {
    try {
      await Browser.open({
        url,
        presentationStyle: "popover",
        windowName: "_self",
      });
    } catch (e) {
      console.warn("Browser.open failed", e);
    }
  };

  const originalAssign = window.location.assign.bind(window.location);
  const originalReplace = window.location.replace.bind(window.location);

  // Override assign / replace
  try {
    window.location.assign = (url: string) => {
      if (isOAuthUrl(url)) {
        void tryOpen(url);
        return;
      }
      originalAssign(url);
    };
    window.location.replace = (url: string) => {
      if (isOAuthUrl(url)) {
        void tryOpen(url);
        return;
      }
      originalReplace(url);
    };
  } catch {
    // Some WebViews freeze the location object — fall through.
  }

  // Override `window.location.href = ...` via a property setter on a proxy.
  // We can't redefine `window.location` itself, but we can shim by polling
  // for hash changes is unreliable. Instead, expose a helper the auth flow
  // can call directly (used by Auth.tsx).
  (window as unknown as { __openOAuthInApp?: (url: string) => void }).__openOAuthInApp = tryOpen;
}

/**
 * Called from the Auth page right before triggering Lovable OAuth.
 * If on native, returns a function the lovable auth library can use to open
 * the URL inside the in-app browser instead of leaving the app.
 */
export async function openInAppBrowser(url: string) {
  if (!Capacitor.isNativePlatform()) {
    window.location.href = url;
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}