import { isValidUsername } from "./usernameRules";
import { ANDROID_STORE_URL } from "./forceUpdate";

export const INVITE_REF_KEY = "aelixto-invite-ref";
export const INVITE_CHANGED_EVENT = "aelixto-invite-changed";
export const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000;

export function referralFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const trusted = (url.protocol === "https:" && url.hostname === "aelixto.com") ||
      (["aelixto:", "com.aelixto.app10:"].includes(url.protocol) && url.hostname === "invite");
    if (!trusted) return null;
    const ref = url.searchParams.get("ref");
    return ref && isValidUsername(ref) && ref === ref.trim() ? ref : null;
  } catch { return null; }
}

export function referralFromInstallReferrer(raw: string): string | null {
  const ref = new URLSearchParams(raw).get("ref");
  return ref && isValidUsername(ref) && ref === ref.trim() ? ref : null;
}

export function inviteUrl(username: string): string {
  return `https://aelixto.com/get?ref=${encodeURIComponent(username)}`;
}

export function inviteStoreUrl(ref: string | null): string {
  const url = new URL(ANDROID_STORE_URL);
  if (ref && isValidUsername(ref)) url.searchParams.set("referrer", new URLSearchParams({ ref }).toString());
  return url.toString();
}

export function isNewInviteAccount(createdAt: string | undefined, now = Date.now()): boolean {
  const created = Date.parse(createdAt ?? "");
  return Number.isFinite(created) && created <= now && now - created <= NEW_ACCOUNT_WINDOW_MS;
}

export function rememberInvite(ref: string): void {
  if (!isValidUsername(ref)) return;
  try {
    localStorage.setItem(INVITE_REF_KEY, ref);
    window.dispatchEvent(new Event(INVITE_CHANGED_EVENT));
  } catch { /* storage unavailable */ }
}