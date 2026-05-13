import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "aelixto_daily_post_limit";
export const DAILY_POST_LIMIT = 5;

interface StoredState {
  date: string;
  count: number;
}

const todayKey = () => new Date().toLocaleDateString();

const readState = (): StoredState => {
  const today = todayKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // ignore
  }
  return fresh;
};

const writeState = (state: StoredState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

const EVENT = "aelixto:daily-post-limit-changed";

export const useDailyPostLimit = () => {
  const [state, setState] = useState<StoredState>(() => readState());

  useEffect(() => {
    const sync = () => setState(readState());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const increment = useCallback(() => {
    const current = readState();
    const next: StoredState = {
      date: current.date,
      count: Math.min(DAILY_POST_LIMIT, current.count + 1),
    };
    writeState(next);
    setState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const remaining = Math.max(0, DAILY_POST_LIMIT - state.count);
  const reached = state.count >= DAILY_POST_LIMIT;

  return { count: state.count, remaining, limit: DAILY_POST_LIMIT, reached, increment };
};