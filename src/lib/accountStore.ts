import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const SESSIONS_KEY = "aelixto-account-sessions";
const META_KEY = "aelixto-known-accounts";

export interface StoredSession {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export interface AccountMeta {
  id: string;
  username: string;
  avatar_url: string | null;
}

const safeRead = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const safeWrite = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

export const getStoredSessions = (): StoredSession[] =>
  safeRead<StoredSession[]>(SESSIONS_KEY) ?? [];

export const getKnownAccounts = (): AccountMeta[] =>
  safeRead<AccountMeta[]>(META_KEY) ?? [];

export const saveSession = (session: Session) => {
  if (!session?.user || !session.access_token || !session.refresh_token) return;
  const list = getStoredSessions().filter((s) => s.user_id !== session.user.id);
  list.unshift({
    user_id: session.user.id,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  });
  safeWrite(SESSIONS_KEY, list.slice(0, 5));
};

export const upsertAccountMeta = (meta: AccountMeta) => {
  const list = getKnownAccounts().filter((a) => a.id !== meta.id);
  list.unshift(meta);
  safeWrite(META_KEY, list.slice(0, 5));
};

export const removeAccount = (userId: string) => {
  safeWrite(SESSIONS_KEY, getStoredSessions().filter((s) => s.user_id !== userId));
  safeWrite(META_KEY, getKnownAccounts().filter((a) => a.id !== userId));
};

export const switchToAccount = async (userId: string): Promise<boolean> => {
  const stored = getStoredSessions().find((s) => s.user_id === userId);
  if (!stored) return false;
  const { error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });
  if (error) {
    // Token expired or invalid — drop it so user can re-add
    removeAccount(userId);
    return false;
  }
  return true;
};
