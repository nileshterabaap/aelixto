/**
 * Simple Global Media Controller
 *
 * Rules:
 * 1. Only one native media element plays at a time.
 * 2. When a post leaves the viewport, all its native media is paused.
 * 3. No iframe manipulation whatsoever — no src changes, no visibility toggling.
 */

let currentPlayingMedia: HTMLMediaElement | null = null;

function handlePlay(this: HTMLMediaElement) {
  if (currentPlayingMedia && currentPlayingMedia !== this) {
    try { currentPlayingMedia.pause(); } catch {}
  }
  currentPlayingMedia = this;
}

/** Register a native media element so only one plays globally. */
function registerPlayableMedia(el: HTMLMediaElement) {
  el.removeEventListener('play', handlePlay); // prevent duplicates
  el.addEventListener('play', handlePlay);
}

// ── Single global IntersectionObserver for post containers ──────────

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        entry.target.querySelectorAll<HTMLMediaElement>('video, audio').forEach((v) => {
          try { v.pause(); } catch {}
        });
      }
    }
  },
  { threshold: 0.2 }
);

/** Observe a post container for viewport exit. */
export function observePost(el: HTMLElement) {
  observer.observe(el);
}

/** Stop observing a post container. */
export function unobservePost(el: HTMLElement) {
  observer.unobserve(el);
}

/**
 * Scan a container for native media elements and register them.
 * Call after mount and after SDK hydration injects new elements.
 */
export function scanAndRegisterMedia(container: HTMLElement) {
  container.querySelectorAll<HTMLMediaElement>('video, audio').forEach(registerPlayableMedia);
}

/** Pause everything globally (e.g. on route change). */
export function pauseAllMedia() {
  if (currentPlayingMedia) {
    try { currentPlayingMedia.pause(); } catch {}
    currentPlayingMedia = null;
  }
  document.querySelectorAll<HTMLMediaElement>('video, audio').forEach((el) => {
    try { if (!el.paused) el.pause(); } catch {}
  });
}
