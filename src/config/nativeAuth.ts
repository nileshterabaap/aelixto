/**
 * Client IDs for the fully native sign-in flows (Credential Manager on
 * Android, GoogleSignIn / Sign in with Apple on iOS).
 *
 * These are PUBLIC identifiers — they are safe in the codebase and are also
 * embedded in the shipped native binaries. They are NOT secrets.
 *
 * Fill these in after creating the OAuth clients, and make sure the same
 * client IDs are registered on the backend auth provider (Cloud → Users →
 * Authentication Settings → Sign In Methods → Google / Apple → "use your own
 * credentials"). Until then `isNativeAuthConfigured()` returns false and the
 * app transparently falls back to the browser-based OAuth flow.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const NATIVE_AUTH_CONFIG = {
  /** Google Cloud → Credentials → OAuth client ID of type **Web application**.
   *  Android Credential Manager requires the *web* client ID, not the Android one.
   *  The Android client (with your release + debug SHA-1) must still exist in the
   *  same project, but is never referenced here. */
  googleWebClientId: env.VITE_GOOGLE_WEB_CLIENT_ID ?? "",
  /** Google Cloud → OAuth client ID of type **iOS** (bundle id com.aelixto.app10). */
  googleIosClientId: env.VITE_GOOGLE_IOS_CLIENT_ID ?? "",
  /** Apple Developer → Identifiers → Services ID. Only needed for non-iOS Apple flows. */
  appleServiceId: env.VITE_APPLE_SERVICE_ID ?? "",
  /** Apple return URL configured on the Services ID. Only needed for non-iOS Apple flows. */
  appleRedirectUrl: env.VITE_APPLE_REDIRECT_URL ?? "",
} as const;

export const isNativeAuthConfigured = (provider: "google" | "apple") => {
  if (provider === "google") return NATIVE_AUTH_CONFIG.googleWebClientId.length > 0;
  // On iOS the native Apple sheet needs no client id — the bundle id + the
  // "Sign in with Apple" capability are enough.
  return true;
};

// Boot-time diagnostic: shows in Logcat whether the release bundle actually
// contains the OAuth client IDs (empty string = env var missing at build time).
console.log(
  "[auth] nativeAuth config: googleWebClientId =",
  NATIVE_AUTH_CONFIG.googleWebClientId ? "set" : "MISSING",
  "googleIosClientId =",
  NATIVE_AUTH_CONFIG.googleIosClientId ? "set" : "MISSING",
);
