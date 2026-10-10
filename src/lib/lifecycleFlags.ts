/**
 * Temporary A/B switches for the media auto-pause lifecycle (debug only).
 * All default ON (= current behaviour). Persisted in localStorage.
 */
export type LifecycleFlag = 'mute' | 'freezePointer' | 'hardSuspend' | 'exclusivePause' | 'scrollFreeze';
export type LifecycleFlags = Record<LifecycleFlag, boolean>;

const KEY = 'aelix-lifecycle-flags';
const DEFAULTS: LifecycleFlags = { mute: true, freezePointer: true, hardSuspend: true, exclusivePause: true, scrollFreeze: true };

let cache: LifecycleFlags | null = null;

export function getLifecycleFlags(): LifecycleFlags {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    cache = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch { cache = { ...DEFAULTS }; }
  return cache!;
}

export function flagOn(f: LifecycleFlag): boolean { return getLifecycleFlags()[f]; }

export function setLifecycleFlags(next: Partial<LifecycleFlags>) {
  cache = { ...getLifecycleFlags(), ...next };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* noop */ }
}

export function allLifecycleFlags(on: boolean) {
  setLifecycleFlags({ mute: on, freezePointer: on, hardSuspend: on, exclusivePause: on, scrollFreeze: on });
}

export function flagsSignature(): string {
  const f = getLifecycleFlags();
  return (Object.keys(DEFAULTS) as LifecycleFlag[]).filter((k) => !f[k]).map((k) => 'no-' + k).join(',') || 'all-on';
}
