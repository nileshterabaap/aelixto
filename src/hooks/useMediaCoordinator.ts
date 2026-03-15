/**
 * Global Media Coordinator — Singleton
 *
 * One IntersectionObserver tracks all registered post containers.
 * The post with the highest viewport coverage among those flagged
 * as "playable" becomes the sole active media post.
 *
 * No hard-suspend (about:blank) is ever performed.
 */

type ActiveChangeCallback = (active: boolean) => void;

interface TrackedPost {
  element: HTMLElement;
  ratio: number;
  hasPlayableMedia: boolean;
  callback: ActiveChangeCallback;
  isActive: boolean;
}

class MediaCoordinator {
  private static readonly MIN_ACTIVE_RATIO = 0.5;

  private observer: IntersectionObserver;
  private posts = new Map<string, TrackedPost>();
  private activePostId: string | null = null;
  private recalcRaf: number | null = null;

  constructor() {
    this.observer = new IntersectionObserver(this.handleIntersection, {
      // Granular thresholds centered around 50% visibility activation.
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
    this.posts.set(postId, {
      element,
      ratio: prev?.element === element ? prev.ratio : 0,
      hasPlayableMedia,
      callback,
      isActive: prev?.isActive ?? false,
    });

    this.observer.observe(element);
    this.scheduleRecalc();
  }

  unregister(postId: string) {
    const entry = this.posts.get(postId);
    if (!entry) return;

    if (entry.isActive) {
      entry.isActive = false;
      entry.callback(false);
    }

    this.observer.unobserve(entry.element);
    this.posts.delete(postId);

    if (this.activePostId === postId) {
      this.activePostId = null;
    }

    this.scheduleRecalc();
  }

  /** Update the playable-media flag for a post (e.g. after late SDK hydration). */
  updatePlayableStatus(postId: string, hasPlayableMedia: boolean) {
    const entry = this.posts.get(postId);
    if (!entry || entry.hasPlayableMedia === hasPlayableMedia) return;

    entry.hasPlayableMedia = hasPlayableMedia;

    if (!hasPlayableMedia && entry.isActive) {
      entry.isActive = false;
      entry.callback(false);
      if (this.activePostId === postId) this.activePostId = null;
    }

    this.scheduleRecalc();
  }

  /** Pause all media globally (used on route change). */
  pauseAll() {
    this.activePostId = null;

    for (const entry of this.posts.values()) {
      if (!entry.isActive) continue;
      entry.isActive = false;
      entry.callback(false);
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

    // Require minimum 50% visibility to be considered active
    if (bestRatio < MediaCoordinator.MIN_ACTIVE_RATIO) bestId = null;

    this.activePostId = bestId;

    for (const [id, entry] of this.posts) {
      const shouldBeActive = entry.hasPlayableMedia && id === bestId;
      if (entry.isActive === shouldBeActive) continue;
      entry.isActive = shouldBeActive;
      entry.callback(shouldBeActive);
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
