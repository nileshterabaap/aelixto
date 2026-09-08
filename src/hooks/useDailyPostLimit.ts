import { useCallback, useEffect, useState } from "react";
import { useSession } from "./useSession";
import { useCurrentProfile } from "./useCurrentProfile";

const STORAGE_KEY_BASE = "aelixto_daily_post_limit";
export const DAILY_POST_LIMIT = 5;
// Usernames exempt from the daily slot limit (unlimited posting).
const UNLIMITED_USERNAMES = new Set<string>(["bpp"]);

interface StoredState {
  date: string;
  count: number;
}

// Day key based on Pacific Time so slots reset at 12:00 AM PT.
const ptDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const todayKey = () => ptDateFormatter.format(new Date());

// Compute ms until the next 12:00 AM Pacific Time.
const ptTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const msUntilPtMidnight = () => {
  const parts = ptTimeFormatter.formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let h = get("hour");
  if (h === 24) h = 0; // some engines emit 24 for midnight
  const secondsSinceMidnight = h * 3600 + get("minute") * 60 + get("second");
  const remaining = 86400 - secondsSinceMidnight;
  return remaining * 1000;
};

const formatCountdown = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
};

export const PT_RESET_LABEL = "Daily reset: 12:00 AM PT";

const storageKeyFor = (userId: string | null | undefined) =>
  userId ? `${STORAGE_KEY_BASE}:${userId}` : STORAGE_KEY_BASE;

const readState = (userId: string | null | undefined): StoredState => {
  const today = todayKey();
  const key = storageKeyFor(userId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState;
      if (parsed && parsed.date === today && typeof parsed.count === "number") {
        return { date: today, count: Math.max(0, Math.min(DAILY_POST_LIMIT, parsed.count)) };
      }
    }
  } catch {
    // fall through to reset
  }
  const fresh = { date: today, count: 0 };
  try {
    localStorage.setItem(key, JSON.stringify(fresh));
  } catch {
    // ignore
  }
  return fresh;
};

const writeState = (userId: string | null | undefined, state: StoredState) => {
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(state));
  } catch {
    // ignore
  }
};

const EVENT = "aelixto:daily-post-limit-changed";

export const useDailyPostLimit = () => {
  const { user } = useSession();
  const { profile } = useCurrentProfile();
  const userId = user?.id ?? null;
  const isUnlimited = !!profile?.username && UNLIMITED_USERNAMES.has(profile.username.toLowerCase());
  const [state, setState] = useState<StoredState>(() => readState(userId));
  const [resetMs, setResetMs] = useState<number>(() => msUntilPtMidnight());

  useEffect(() => {
    setState(readState(userId));
    const sync = () => setState(readState(userId));
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [userId]);

  useEffect(() => {
    setResetMs(msUntilPtMidnight());
    const id = window.setInterval(() => setResetMs(msUntilPtMidnight()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const increment = useCallback(() => {
    const current = readState(userId);
    const next: StoredState = {
      date: current.date,
      count: Math.min(DAILY_POST_LIMIT, current.count + 1),
    };
    writeState(userId, next);
    setState(next);
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);

  const decrement = useCallback(() => {
    const current = readState(userId);
    const next: StoredState = {
      date: current.date,
      count: Math.max(0, current.count - 1),
    };
    writeState(userId, next);
    setState(next);
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);

  const remaining = isUnlimited
    ? DAILY_POST_LIMIT
    : Math.max(0, DAILY_POST_LIMIT - state.count);
  const reached = isUnlimited ? false : state.count >= DAILY_POST_LIMIT;
  const resetCountdown = formatCountdown(resetMs);
  const resetLabel = PT_RESET_LABEL;

  return {
    count: state.count,
    remaining,
    limit: DAILY_POST_LIMIT,
    reached,
    increment,
    decrement,
    isUnlimited,
    resetCountdown,
    resetLabel,
  };
};