// Tracks per-post embed readiness so the feed can push slow embeds down
// and surface faster ones — but only for posts the user hasn't scrolled past yet.
//
// Rules:
//  - `ready`     → embed rendered successfully (locks the post in place).
//  - `timeout`   → still loading after SLOW_THRESHOLD; eligible to sink.
//  - `past`      → user has scrolled past the post; locks it in place.
//
// A post is "committed" (unmovable) if it's `ready` or `past`.
// Anything else can be reordered in the display list.

export const SLOW_EMBED_MS = 5000;

type Status = 'loading' | 'ready' | 'timeout' | 'past';

const state = new Map<string, Status>();
const watchers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((cb) => {
    try { cb(); } catch { /* noop */ }
  });
};

const set = (id: string, status: Status) => {
  const prev = state.get(id);
  // Don't downgrade a committed post.
  if (prev === 'ready' || prev === 'past') {
    if (status !== 'ready' && status !== 'past') return;
  }
  if (prev === status) return;
  state.set(id, status);
  emit();
};

export const startEmbedWatch = (id: string, ms: number = SLOW_EMBED_MS) => {
  if (!id) return;
  const current = state.get(id);
  if (current === 'ready' || current === 'past') return;
  if (watchers.has(id)) return;
  if (!current) set(id, 'loading');
  const t = setTimeout(() => {
    watchers.delete(id);
    const s = state.get(id);
    if (s === 'ready' || s === 'past') return;
    set(id, 'timeout');
  }, ms);
  watchers.set(id, t);
};

export const markEmbedReady = (id: string) => {
  if (!id) return;
  const t = watchers.get(id);
  if (t) { clearTimeout(t); watchers.delete(id); }
  set(id, 'ready');
};

export const markScrolledPast = (id: string) => {
  if (!id) return;
  const s = state.get(id);
  if (s === 'ready') return; // already committed
  set(id, 'past');
};

export const getEmbedStatus = (id: string): Status | undefined => state.get(id);

export const isCommitted = (id: string): boolean => {
  const s = state.get(id);
  return s === 'ready' || s === 'past';
};

export const isSlow = (id: string): boolean => state.get(id) === 'timeout';

export const subscribeEmbedReadiness = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

/**
 * Reorder a post list so that "slow" (timed-out, not-yet-ready) posts sink
 * below still-loading / ready ones, while any post the user has already
 * committed to (ready or scrolled past) stays exactly where it is.
 */
export const reorderBySlowness = <T extends { id: string }>(posts: T[]): T[] => {
  if (posts.length < 2) return posts;

  // Collect indices of reorderable slots and the posts occupying them.
  const reorderableSlots: number[] = [];
  const reorderablePosts: T[] = [];
  for (let i = 0; i < posts.length; i++) {
    if (!isCommitted(posts[i].id)) {
      reorderableSlots.push(i);
      reorderablePosts.push(posts[i]);
    }
  }
  if (reorderableSlots.length < 2) return posts;

  // Stable partition: non-slow first (preserving original order), then slow.
  const fast: T[] = [];
  const slow: T[] = [];
  for (const p of reorderablePosts) {
    if (isSlow(p.id)) slow.push(p); else fast.push(p);
  }
  if (slow.length === 0) return posts;

  const reshuffled = [...fast, ...slow];
  // Was it actually changed?
  let changed = false;
  for (let i = 0; i < reshuffled.length; i++) {
    if (reshuffled[i].id !== reorderablePosts[i].id) { changed = true; break; }
  }
  if (!changed) return posts;

  const out = posts.slice();
  for (let i = 0; i < reorderableSlots.length; i++) {
    out[reorderableSlots[i]] = reshuffled[i];
  }
  return out;
};