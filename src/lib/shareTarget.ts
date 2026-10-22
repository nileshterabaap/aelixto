import { Capacitor } from "@capacitor/core";
import { SendIntent } from "./sendIntentPlugin";
import { App } from "@capacitor/app";

/**
 * Receives links shared into Aelixto from other apps' native share sheets
 * (Android ACTION_SEND / iOS Share Extension) and hands them to the
 * create-post composer.
 *
 * The shared payload is stashed here; <CreatePostDialog> consumes it the
 * moment it opens so the user lands straight on the preview step.
 *
 * A pending link expires after a few minutes so a share that could not be
 * shown (e.g. while signed out) never pops up unexpectedly much later.
 */
export const SHARED_LINK_TTL_MS = 10 * 60 * 1000;

let pendingSharedLink: string | null = null;
let pendingSharedAt = 0;
const subscribers = new Set<() => void>();

const isExpired = (now = Date.now()) => now - pendingSharedAt > SHARED_LINK_TTL_MS;

export const setPendingSharedLink = (url: string, now = Date.now()) => {
  pendingSharedLink = url;
  pendingSharedAt = now;
  subscribers.forEach((cb) => cb());
};

/** True while a shared link is waiting and has not expired. */
export const hasPendingSharedLink = (now = Date.now()): boolean => {
  if (pendingSharedLink && isExpired(now)) pendingSharedLink = null;
  return pendingSharedLink !== null;
};

/** Reads and clears the pending shared link (single consumer). */
export const consumePendingSharedLink = (now = Date.now()): string | null => {
  const url = hasPendingSharedLink(now) ? pendingSharedLink : null;
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

let lastNativeLink: string | null = null;

/**
 * Hands a link read from the native share bridge to the composer.
 *
 * Android keeps returning the launch share intent on every app resume, so
 * the same link would be re-delivered each time the user comes back (and
 * would close/reopen an open composer, losing their edits). On Android a
 * link is therefore delivered once per app session. iOS clears its App
 * Group hand-off after each read, so every iOS read is a genuine new share.
 */
export const acceptNativeSharedLink = (
  url: string,
  platform: string = Capacitor.getPlatform(),
  now = Date.now(),
): boolean => {
  if (platform === "android" && url === lastNativeLink) return false;
  lastNativeLink = url;
  setPendingSharedLink(url, now);
  return true;
};

/** Test helper: forget the last native link (simulates a fresh app launch). */
export const resetNativeSharedLinkMemory = () => {
  lastNativeLink = null;
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
    if (/^https?:\/\//i.test(url)) acceptNativeSharedLink(url);
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
