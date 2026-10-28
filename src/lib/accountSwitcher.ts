/**
 * Instagram/X-style multiple accounts on one device.
 *
 * - Every signed-in account's session is saved locally (max 5).
 * - Switching swaps the auth client's session, then restarts the app with a
 *   fresh data cache so nothing from the previous account is shown.
 * - A saved session whose token has expired is refreshed *before* it is
 *   handed to the auth client, so a dead account can never sign out the
 *   one currently in use.
 * - Logging out removes this phone's push registration for that account
 *   only, then opens the next saved account (if any).
 */
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  type SavedAccount,
  canAddAccount,
  needsRefresh,
  parseAccounts,
  pickNextAccount,
  removeAccount,
  upsertAccount,
} from "./accountStore";

const STORE_KEY = "aelixto-accounts-v1";
const ACTIVE_KEY = "aelixto-active-user-id";
/** Read by queryPersister on the next start to discard the old account's cache. */
export const RESET_CACHE_KEY = "aelixto-reset-query-cache";
/** Latest native push token for this phone (written by capacitor-init). */
export const PUSH_TOKEN_KEY = "aelixto-push-token";

export const ACCOUNTS_CHANGED_EVENT = "aelixto:accounts-changed";
export const OPEN_ACCOUNT_SWITCHER_EVENT = "aelixto:open-account-switcher";

let switching = false;
let installed = false;

export function readAccounts(): SavedAccount[] {
  try {
    return parseAccounts(window.localStorage.getItem(STORE_KEY));
  } catch {
    return [];
  }
}

function writeAccounts(list: SavedAccount[]) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(ACCOUNTS_CHANGED_EVENT));
}

export function getActiveUserId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function setActiveUserId(id: string) {
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function canAddAnotherAccount(): boolean {
  return canAddAccount(readAccounts());
}

export function openAccountSwitcher() {
  window.dispatchEvent(new Event(OPEN_ACCOUNT_SWITCHER_EVENT));
}

function saveSession(session: Session, markUsed: boolean) {
  const list = readAccounts();
  writeAccounts(
    upsertAccount(list, {
      userId: session.user.id,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
      ...(markUsed ? { lastUsedAt: Date.now() } : {}),
    }),
  );
}

async function refreshProfileInfo(userId: string) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return;
    const list = readAccounts();
    if (!list.some((a) => a.userId === userId)) return;
    writeAccounts(
      upsertAccount(list, {
        userId,
        username: data.username,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
      }),
    );
  } catch {
    /* keep whatever we had */
  }
}

/** Restart the app on Home with an empty data cache. */
function restartApp(path = "/") {
  try {
    window.localStorage.setItem(RESET_CACHE_KEY, "1");
  } catch {
    /* ignore */
  }
  window.location.replace(path);
}

/**
 * Keep saved tokens in step with the auth client, and restart cleanly when a
 * different account becomes active (from any sign-in path: password, Google,
 * Apple, or the native browser hand-off).
 */
export function installAccountSync() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (!session?.user) return;
    const uid = session.user.id;
    saveSession(session, event === "SIGNED_IN" || event === "INITIAL_SESSION");
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
      // Never call the auth client from inside its own callback.
      setTimeout(() => void refreshProfileInfo(uid), 0);
    }
    const prev = getActiveUserId();
    setActiveUserId(uid);
    if (prev && prev !== uid && !switching) {
      switching = true;
      restartApp("/");
    }
  });
}

type RefreshOutcome =
  | { ok: true; access_token: string; refresh_token: string; expires_at: number }
  | { ok: false; expired: boolean };

async function refreshTokens(refreshToken: string): Promise<RefreshOutcome> {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, expired: res.status >= 400 && res.status < 500 };
    const json = await res.json();
    if (!json?.access_token || !json?.refresh_token) return { ok: false, expired: false };
    return {
      ok: true,
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    };
  } catch {
    return { ok: false, expired: false };
  } finally {
    clearTimeout(timer);
  }
}

export type SwitchResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "network" | "missing"; username?: string | null };

/** Hand a saved account's session to the auth client (no restart). */
async function activateSaved(userId: string): Promise<SwitchResult> {
  const target = readAccounts().find((a) => a.userId === userId);
  if (!target) return { ok: false, reason: "missing" };

  let tokens = { access_token: target.accessToken, refresh_token: target.refreshToken };
  if (needsRefresh(target, Date.now() / 1000)) {
    const r = await refreshTokens(target.refreshToken);
    if (!r.ok) {
      if (r.expired) writeAccounts(removeAccount(readAccounts(), userId));
      return { ok: false, reason: r.expired ? "expired" : "network", username: target.username };
    }
    tokens = { access_token: r.access_token, refresh_token: r.refresh_token };
    writeAccounts(
      upsertAccount(readAccounts(), {
        userId,
        accessToken: r.access_token,
        refreshToken: r.refresh_token,
        expiresAt: r.expires_at,
      }),
    );
  }

  const { error } = await supabase.auth.setSession(tokens);
  if (error) {
    const status = (error as { status?: number }).status ?? 0;
    const expired = status === 401 || status === 403;
    if (expired) writeAccounts(removeAccount(readAccounts(), userId));
    return { ok: false, reason: expired ? "expired" : "network", username: target.username };
  }
  return { ok: true };
}

/** Switch to a saved account and restart the app on Home. */
export async function switchToAccount(userId: string): Promise<SwitchResult> {
  const { data } = await supabase.auth.getSession();
  const current = data.session;
  if (current?.user.id === userId) return { ok: true };
  if (current) saveSession(current, false);

  switching = true;
  const res = await activateSaved(userId);
  if (!res.ok) {
    switching = false;
    return res;
  }
  setActiveUserId(userId);
  writeAccounts(upsertAccount(readAccounts(), { userId, lastUsedAt: Date.now() }));
  restartApp("/");
  return { ok: true };
}

/** Stop this phone receiving push notifications for the signed-in account. */
async function removeThisDevicePush(userId: string) {
  const work = async () => {
    try {
      const token = window.localStorage.getItem(PUSH_TOKEN_KEY);
      if (token) {
        await supabase.from("device_tokens").delete().eq("user_id", userId).eq("token", token);
      }
    } catch {
      /* best effort */
    }
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", sub.endpoint);
        }
      }
    } catch {
      /* best effort */
    }
  };
  await Promise.race([work(), new Promise((r) => setTimeout(r, 5000))]);
}

/**
 * Log out the active account. If other accounts are saved, the most recently
 * used one opens next; otherwise the sign-in page opens.
 */
export async function logOutCurrentAccount(): Promise<void> {
  switching = true;
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? null;
  if (uid) await removeThisDevicePush(uid);
  try {
    await supabase.auth.signOut();
  } catch {
    /* local session is cleared regardless */
  }
  if (uid) writeAccounts(removeAccount(readAccounts(), uid));

  // Open the next saved account that still works.
  for (;;) {
    const next = pickNextAccount(readAccounts(), uid);
    if (!next) break;
    const res = await activateSaved(next.userId);
    if (res.ok) {
      setActiveUserId(next.userId);
      writeAccounts(upsertAccount(readAccounts(), { userId: next.userId, lastUsedAt: Date.now() }));
      restartApp("/");
      return;
    }
    if (res.reason === "network") break;
    // expired accounts were already removed; try the next one
  }
  restartApp("/auth");
}

/** Log out every account saved on this device. */
export async function logOutAllAccounts(): Promise<void> {
  switching = true;
  const { data } = await supabase.auth.getSession();
  const currentId = data.session?.user.id ?? null;

  for (const acc of readAccounts()) {
    if (acc.userId === currentId) continue;
    const res = await activateSaved(acc.userId);
    if (res.ok) {
      await removeThisDevicePush(acc.userId);
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
  }

  if (data.session) {
    // Put the original session back so it can be logged out properly too.
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: readAccounts().find((a) => a.userId === currentId)?.refreshToken ?? data.session.refresh_token,
    });
    if (currentId) await removeThisDevicePush(currentId);
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }
  writeAccounts([]);
  restartApp("/auth");
}
