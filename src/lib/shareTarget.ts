import { Capacitor } from "@capacitor/core";
import { SendIntent } from "send-intent";
import { App } from "@capacitor/app";

/**
 * Receives links shared into Aelixto from other apps' native share sheets
 * (Android ACTION_SEND / iOS Share Extension) and hands them to the
 * create-post composer.
 *
 * The shared payload is stashed here; <CreatePostDialog> consumes it the
 * moment it opens so the user lands straight on the preview step.
 */
let pendingSharedLink: string | null = null;
const subscribers = new Set<() => void>();

export const setPendingSharedLink = (url: string) => {
  pendingSharedLink = url;
  subscribers.forEach((cb) => cb());
};

/** Reads and clears the pending shared link (single consumer). */
export const consumePendingSharedLink = (): string | null => {
  const url = pendingSharedLink;
  pendingSharedLink = null;
  return url;
};

export const onSharedLink = (cb: () => void) => {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
};

/** Pulls the first http(s) URL out of whatever text the source app shared. */
const extractUrl = (raw: string): string => {
  const match = raw.match(/https?:\/\/[^\s<>"')]+/i);
  return (match ? match[0] : raw).trim();
};

const readIntent = async () => {
  try {
    const result = await SendIntent.checkSendIntentReceived();
    if (!result) return;
    const raw =
      (result as { url?: string }).url ||
      (result as { title?: string }).title ||
      "";
    if (!raw) return;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      /* keep raw */
    }
    const url = extractUrl(decoded);
    if (/^https?:\/\//i.test(url)) setPendingSharedLink(url);
  } catch {
    // No intent waiting — normal cold start.
  }
};

let initialised = false;

export const initShareTarget = () => {
  if (initialised || !Capacitor.isNativePlatform()) return;
  initialised = true;

  void readIntent();
  window.addEventListener("sendIntentReceived", () => void readIntent());
  void App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) void readIntent();
  });
};
