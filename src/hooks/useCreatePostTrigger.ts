import { useEffect } from "react";

export const CREATE_POST_EVENT = "aelixto:create-post";

/**
 * Keep-alive routes (Home, UserProfile) stay mounted alongside the
 * currently-visible page, so a naive global event would fan-out to
 * multiple <CreatePostDialog> instances and the user would have to
 * tap "X" once per hidden dialog before the visible one closed.
 *
 * Each subscriber registers with the pathname it owns; on trigger we
 * pick the single listener whose pathname matches the current URL,
 * falling back to the most recently registered one. Result: exactly
 * one dialog opens — the one the user is actually looking at — so
 * the close button works in a single tap.
 */
type Entry = { pathname: string; cb: () => void };
const listeners: Entry[] = [];

export const useCreatePostTrigger = (onOpen: () => void) => {
  useEffect(() => {
    const entry: Entry = { pathname: window.location.pathname, cb: onOpen };
    listeners.push(entry);
    return () => {
      const i = listeners.indexOf(entry);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, [onOpen]);
};

export const triggerCreatePost = () => {
  if (listeners.length === 0) {
    window.dispatchEvent(new CustomEvent(CREATE_POST_EVENT));
    return;
  }
  const here = window.location.pathname;
  // Prefer an exact match for the current pathname; otherwise fall back
  // to the most recently mounted listener (the visible non-keep-alive page).
  const match = [...listeners].reverse().find((l) => l.pathname === here)
    ?? listeners[listeners.length - 1];
  match.cb();
};