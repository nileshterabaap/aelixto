import { useEffect } from "react";

/**
 * AuthBridge
 * ----------
 * Lives at /~auth-bridge on the published web app.
 *
 * Native (Capacitor) Google sign-in opens a Chrome Custom Tab pointed at
 * https://aelixto.com/~auth-bridge. After the OAuth broker finishes it
 * redirects here with the access/refresh tokens in the URL hash.
 *
 * This page immediately rewrites the location to a custom-scheme URL
 * (com.aelixto.app10://oauth-callback#…), which Android resolves to our
 * installed app via the intent filter declared in AndroidManifest.xml.
 * The app's appUrlOpen listener then completes the sign-in.
 *
 * If opened in a regular browser (no app installed), it falls through to
 * the normal site root so users still land somewhere sensible.
 */
const APP_SCHEME = "com.aelixto.app10";
const APP_PACKAGE = "com.aelixto.app10";

const AuthBridge = () => {
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const payload = hash || search;

    if (!payload) {
      window.location.replace("/");
      return;
    }

    // Hand the tokens off to the native app. Chrome handles `intent://` links
    // more reliably from Custom Tabs; keep the custom-scheme URL as fallback.
    const customSchemeLink = `${APP_SCHEME}://oauth-callback${payload}`;
    const intentPayload = payload.startsWith("#") ? `?${payload.slice(1)}` : payload;
    const fallbackUrl = encodeURIComponent(`${window.location.origin}/`);
    const intentLink = `intent://oauth-callback${intentPayload}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};S.browser_fallback_url=${fallbackUrl};end`;

    window.location.replace(intentLink);

    const schemeFallback = window.setTimeout(() => {
      window.location.replace(customSchemeLink);
    }, 500);

    // Web fallback: if nothing handled the scheme within ~1.2s, go home.
    const fallback = window.setTimeout(() => {
      window.location.replace("/");
    }, 1200);
    return () => {
      window.clearTimeout(schemeFallback);
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Returning to the app…</p>
    </div>
  );
};

export default AuthBridge;