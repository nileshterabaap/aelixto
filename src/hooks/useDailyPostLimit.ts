import { useCallback, useEffect, useState } from "react";
import { useSession } from "./useSession";

const STORAGE_KEY_BASE = "aelixto_daily_post_limit";
export const DAILY_POST_LIMIT = 5;
// Toggle: set to false to re-enable the daily post limit.
// Restore phrase: "Bring back post limit.. code 10"
const LIMIT_DISABLED = true;

interface StoredState {
  date: string;
  count: number;
}

const todayKey = () => new Date().toLocaleDateString();

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
  const userId = user?.id ?? null;
  const [state, setState] = useState<StoredState>(() => readState(userId));

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

  const remaining = LIMIT_DISABLED
    ? DAILY_POST_LIMIT
    : Math.max(0, DAILY_POST_LIMIT - state.count);
  const reached = LIMIT_DISABLED ? false : state.count >= DAILY_POST_LIMIT;

  return { count: state.count, remaining, limit: DAILY_POST_LIMIT, reached, increment, decrement };
};