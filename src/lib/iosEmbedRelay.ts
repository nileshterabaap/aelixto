import { Capacitor } from "@capacitor/core";

/**
 * iPhone app only: YouTube refuses players whose page sends no Referer
 * ("Video player configuration error 153"), and the iOS app's
 * capacitor://localhost origin never sends one. Every YouTube player iframe,
 * whichever component rendered it, is pointed at a relay page on the website
 * instead, which hosts the real player with a normal https referrer.
 *
 * The relay URL keeps the original YouTube address in its query string, so
 * existing `iframe[src*="youtube.com"]` pause/visibility logic still matches.
 */
export const EMBED_RELAY_URL = "https://aelixto.com/embed-relay.html";

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "www.youtube-nocookie.com",
]);

export const toYouTubeRelaySrc = (src: string | null): string | null => {
  if (!src) return null;
  try {
    const url = new URL(src, "https://aelixto.com");
    if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname)) return null;
    if (!url.pathname.startsWith("/embed/")) return null;
    return `${EMBED_RELAY_URL}?src=${encodeURIComponent(url.href)}`;
  } catch {
    return null;
  }
};

const rewrite = (iframe: HTMLIFrameElement) => {
  const next = toYouTubeRelaySrc(iframe.getAttribute("src"));
  if (next) iframe.setAttribute("src", next);
};

let installed = false;

export const installIosEmbedRelay = () => {
  if (installed || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return;
  installed = true;

  document.querySelectorAll("iframe").forEach(rewrite);
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target instanceof HTMLIFrameElement) rewrite(record.target);
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLIFrameElement) rewrite(node);
        else if (node instanceof Element) node.querySelectorAll("iframe").forEach(rewrite);
      });
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
};
