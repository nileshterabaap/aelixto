/**
 * Global Media Coordinator — Singleton
 *
 * One IntersectionObserver tracks all registered post containers.
 * The post with the highest viewport coverage among those flagged
 * as "playable" becomes the sole active media post.
 *
 * When the active post changes:
 *   – Previous active post receives `false` → its media is paused.
 *   – New active post receives `true`      → its media resumes.
 *
 * No hard-suspend (about:blank) is ever performed.
 */

type ActiveChangeCallback = (active: boolean) => void;

interface TrackedPost {
  element: HTMLElement;
  ratio: number;
  hasPlayableMedia: boolean;
  callback: ActiveChangeCallback;
}

class MediaCoordinator {
  private observer: IntersectionObserver;
  private posts = new Map<string, TrackedPost>();
  private activePostId: string | null = null;
  private recalcRaf: number | null = null;

  constructor() {
    this.observer = new IntersectionObserver(this.handleIntersection, {
      // Granular thresholds for accurate "most visible" determination
      threshold: [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1.0],
    });
  }

  register(
    postId: string,
    element: HTMLElement,
    hasPlayableMedia: boolean,
    callback: ActiveChangeCallback
  ) {
    const prev = this.posts.get(postId);
    if (prev && prev.element !== element) {
      this.observer.unobserve(prev.element);
    }

    element.setAttribute('data-media-post-id', postId);
    this.posts.set(postId, { element, ratio: 0, hasPlayableMedia, callback });
    this.observer.observe(element);
    console.log(`[MediaCoord] REGISTER postId=${postId} playable=${hasPlayableMedia} totalTracked=${this.posts.size}`);
  }

  unregister(postId: string) {
    const entry = this.posts.get(postId);
    if (!entry) return;

    this.observer.unobserve(entry.element);
    this.posts.delete(postId);
    console.log(`[MediaCoord] UNREGISTER postId=${postId} totalTracked=${this.posts.size}`);

    if (this.activePostId === postId) {
      this.activePostId = null;
      this.scheduleRecalc();
    }
  }

  /** Update the playable-media flag for a post (e.g. after late SDK hydration). */
  updatePlayableStatus(postId: string, hasPlayableMedia: boolean) {
    const entry = this.posts.get(postId);
    if (!entry || entry.hasPlayableMedia === hasPlayableMedia) return;
    entry.hasPlayableMedia = hasPlayableMedia;
    this.scheduleRecalc();
  }

  /** Pause all media globally (used on route change). */
  pauseAll() {
    const prevId = this.activePostId;
    this.activePostId = null;
    if (prevId) {
      this.posts.get(prevId)?.callback(false);
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private handleIntersection = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      const postId = entry.target.getAttribute('data-media-post-id');
      if (!postId) continue;
      const tracked = this.posts.get(postId);
      if (tracked) {
        tracked.ratio = entry.intersectionRatio;
      }
    }
    this.scheduleRecalc();
  };

  private scheduleRecalc() {
    if (this.recalcRaf !== null) return;
    this.recalcRaf = requestAnimationFrame(() => {
      this.recalcRaf = null;
      this.recalculate();
    });
  }

  private recalculate() {
    let bestId: string | null = null;
    let bestRatio = 0;

    for (const [id, entry] of this.posts) {
      if (!entry.hasPlayableMedia) continue;
      if (entry.ratio > bestRatio) {
        bestRatio = entry.ratio;
        bestId = id;
      }
    }

    // Require minimum 20% visibility to be considered active
    if (bestRatio < 0.2) bestId = null;

    if (bestId === this.activePostId) return;

    const prevId = this.activePostId;
    this.activePostId = bestId;

    // Notify previous post it's no longer active → pause
    if (prevId) {
      this.posts.get(prevId)?.callback(false);
    }
    // Notify new active post → resume
    if (bestId) {
      this.posts.get(bestId)?.callback(true);
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let instance: MediaCoordinator | null = null;

export function getMediaCoordinator(): MediaCoordinator {
  if (!instance) {
    instance = new MediaCoordinator();
  }
  return instance;
}
