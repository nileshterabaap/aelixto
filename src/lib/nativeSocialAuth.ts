/**
 * Native provider sign-in (Capacitor only).
 * ----------------------------------------
 * Android → Credential Manager + Google ID (bottom-sheet account picker)
 * iOS     → GoogleSignIn SDK sheet / ASAuthorizationController (Sign in with Apple)
 *
 * Both return an OIDC **ID token**, which we exchange directly with the
 * backend via `supabase.auth.signInWithIdToken()`. No browser tab, no bridge
 * page, no deep link — the session is set in-process and the user never
 * leaves Aelixto.
 *
 * Requires the auth provider to be configured with *our own* Google/Apple
 * client IDs (see NATIVE_AUTH_CONFIG below). When the IDs are absent the
 * caller falls back to the browser-based OAuth flow, so nothing breaks.
 */
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { NATIVE_AUTH_CONFIG, isNativeAuthConfigured } from "@/config/nativeAuth";

let initPromise: Promise<void> | null = null;

const getPlugin = async () => {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  return SocialLogin;
};

const ensureInitialized = async () => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const SocialLogin = await getPlugin();
    await SocialLogin.initialize({
      google: {
        webClientId: NATIVE_AUTH_CONFIG.googleWebClientId,
        iOSClientId: NATIVE_AUTH_CONFIG.googleIosClientId || undefined,
        mode: "offline",
      },
      apple: {
        clientId: NATIVE_AUTH_CONFIG.appleServiceId || undefined,
        redirectUrl: NATIVE_AUTH_CONFIG.appleRedirectUrl || undefined,
      },
    });
  })().catch((e) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
};

/** Random URL-safe string used as the OIDC nonce. */
const randomNonce = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** Apple embeds the nonce verbatim, so we hand it the SHA-256 digest and keep the raw value for the token exchange. */
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

export const canUseNativeSocialAuth = (provider: "google" | "apple") => {
  if (!Capacitor.isNativePlatform()) return false;
  if (!isNativeAuthConfigured(provider)) return false;
  // Sign in with Apple has no native surface on Android; it must use the web flow.
  if (provider === "apple" && Capacitor.getPlatform() !== "ios") return false;
  return true;
};

type NativeResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

const isCancellation = (message: string) => {
  const m = message.toLowerCase();
  return (
    m.includes("cancel") ||
    m.includes("dismiss") ||
    m.includes("user closed") ||
    m.includes("no credential") ||
    m.includes("1001")
  );
};

/**
 * Runs the fully native flow. Returns `ok: false` (with `cancelled`) when the
 * user backed out, or when the native path is unavailable and the caller
 * should fall back to the browser flow.
 */
export const nativeSocialSignIn = async (provider: "google" | "apple"): Promise<NativeResult> => {
  try {
    await ensureInitialized();
    const SocialLogin = await getPlugin();

    const rawNonce = randomNonce();
    const options =
      provider === "apple"
        ? { scopes: ["email", "name"], nonce: await sha256(rawNonce) }
        : { scopes: ["email", "profile"], nonce: rawNonce, forceRefreshToken: true };

    const res = (await SocialLogin.login({
      provider,
      options: options as never,
    })) as unknown as { result?: Record<string, unknown> };

    const result = (res?.result ?? {}) as Record<string, unknown>;
    const idToken =
      (result.idToken as string | undefined) ??
      ((result.profile as { idToken?: string } | undefined)?.idToken) ??
      ((result.accessToken as { idToken?: string } | undefined)?.idToken);

    if (!idToken) {
      return { ok: false, cancelled: false, message: "No identity token returned by the provider." };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider,
      token: idToken,
      nonce: rawNonce,
    });

    if (error) return { ok: false, cancelled: false, message: error.message };
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, cancelled: isCancellation(message), message };
  }
};

/** Best-effort provider sign-out so the next sign-in shows the account picker again. */
export const nativeSocialSignOut = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const SocialLogin = await getPlugin();
    await SocialLogin.logout({ provider: "google" } as never);
  } catch {
    /* provider was never initialized — nothing to do */
  }
};
