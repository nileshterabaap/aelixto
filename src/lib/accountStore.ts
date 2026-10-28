/**
 * Saved accounts for Instagram/X-style account switching.
 *
 * Pure list helpers only (no storage, no network) so the rules can be tested.
 * Each signed-in account keeps its own session tokens on this device; the
 * active one is also held by the auth client itself.
 */

/** Most accounts one device can keep signed in at the same time. */
export const MAX_ACCOUNTS = 5;

export interface SavedAccount {
  userId: string;
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry, seconds since epoch. */
  expiresAt: number;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  /** Last time this account was the active one (ms). */
  lastUsedAt: number;
}

export function parseAccounts(raw: string | null): SavedAccount[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a) =>
        a &&
        typeof a.userId === "string" &&
        typeof a.accessToken === "string" &&
        typeof a.refreshToken === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Add or update an account. Profile details already known are kept when the
 * update doesn't carry them. If the list grows past MAX_ACCOUNTS, the
 * least recently used other account is dropped (never the one being saved).
 */
export function upsertAccount(
  list: SavedAccount[],
  entry: Partial<SavedAccount> & { userId: string },
): SavedAccount[] {
  const existing = list.find((a) => a.userId === entry.userId);
  const merged: SavedAccount = {
    userId: entry.userId,
    accessToken: entry.accessToken ?? existing?.accessToken ?? "",
    refreshToken: entry.refreshToken ?? existing?.refreshToken ?? "",
    expiresAt: entry.expiresAt ?? existing?.expiresAt ?? 0,
    username: entry.username !== undefined ? entry.username : existing?.username ?? null,
    displayName: entry.displayName !== undefined ? entry.displayName : existing?.displayName ?? null,
    avatarUrl: entry.avatarUrl !== undefined ? entry.avatarUrl : existing?.avatarUrl ?? null,
    lastUsedAt: entry.lastUsedAt ?? existing?.lastUsedAt ?? 0,
  };
  if (!merged.accessToken || !merged.refreshToken) return list;

  const others = list.filter((a) => a.userId !== entry.userId);
  const next = existing
    ? list.map((a) => (a.userId === entry.userId ? merged : a))
    : [...list, merged];
  if (next.length <= MAX_ACCOUNTS) return next;

  const dropOrder = [...others].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  const drop = new Set(dropOrder.slice(0, next.length - MAX_ACCOUNTS).map((a) => a.userId));
  return next.filter((a) => !drop.has(a.userId));
}

export function removeAccount(list: SavedAccount[], userId: string): SavedAccount[] {
  return list.filter((a) => a.userId !== userId);
}

/** The account to open after `excludeUserId` logs out: the most recently used other one. */
export function pickNextAccount(list: SavedAccount[], excludeUserId: string | null): SavedAccount | null {
  const others = list.filter((a) => a.userId !== excludeUserId);
  if (others.length === 0) return null;
  return [...others].sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0];
}

export function canAddAccount(list: SavedAccount[]): boolean {
  return list.length < MAX_ACCOUNTS;
}

/** True when the saved access token is expired or about to expire (within 60 s). */
export function needsRefresh(account: SavedAccount, nowSec: number): boolean {
  return !account.expiresAt || account.expiresAt - nowSec < 60;
}

/** Accounts in display order: the active one first, then most recently used. */
export function orderForDisplay(list: SavedAccount[], activeUserId: string | null): SavedAccount[] {
  return [...list].sort((a, b) => {
    if (a.userId === activeUserId) return -1;
    if (b.userId === activeUserId) return 1;
    return b.lastUsedAt - a.lastUsedAt;
  });
}
