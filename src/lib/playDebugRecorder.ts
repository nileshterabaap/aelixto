import { supabase } from '@/integrations/supabase/client';
import { getPostPlaybackGeneration } from '@/lib/playedPosts';
import { flagsSignature } from '@/lib/lifecycleFlags';

/**
 * Hidden diagnostic recorder for the profile grid viewer. Watches (never
 * changes) taps, iframe focus, scroll, iframe mounts/loads, media events,
 * player messages and confirmed-play generations, tagged with grid rank.
 * Every event/label carries `f` = active lifecycle test-switch signature.
 */
export interface DebugEvent { t: number; type: string; p: string; rank?: number; postId?: string; d?: Record<string, unknown>; f?: string }
export type DebugVerdict = 'worked' | 'not_worked' | 'not_loaded' | 'frozen' | 'buffered';
export interface DebugLabel { t: number; p: string; rank: number; postId?: string; verdict: DebugVerdict; loads?: number; mounts?: number; liveIframes?: number; longTasks5s?: number; fps?: number; f?: string; lastAttemptConfirmed?: boolean | null; lastTapToConfirmMs?: number | null }
// Per-post counters (persist across platform switches) to tell first load from reloads.
const loadCount = new Map<string, number>();
const mountCount = new Map<string, number>();
const platformsSeen = new Set<string>();
const recentLong: number[] = [];
let lastFps = 0;

const MAX_EVENTS = 8000;
let events: DebugEvent[] = [];
let labels: DebugLabel[] = [];
let t0 = Date.now();
let platform = '';
let root: HTMLElement | null = null;
let cleanup: (() => void) | null = null;

const now = () => Date.now() - t0;

export function logDebug(type: string, rank?: number, postId?: string, d?: Record<string, unknown>) {
  if (!cleanup) return;
  events.push({ t: now(), type, p: platform, rank, postId, d, f: flagsSignature() });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function rankOf(el: Element | null): { rank?: number; postId?: string } {
  const host = el?.closest?.('[data-debug-rank]') as HTMLElement | null;
  if (!host) return {};
  return { rank: Number(host.dataset.debugRank), postId: host.dataset.debugPostId };
}

function describe(el: Element | null) {
  if (!el) return 'null';
  const h = el as HTMLElement;
  const cls = typeof h.className === 'string' ? h.className.split(' ').slice(0, 3).join('.') : '';
  return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
}

function iframeHost(f: HTMLIFrameElement) {
  try { return new URL(f.src).host; } catch { return f.src ? 'srcdoc/other' : 'empty'; }
}

export function startPlayDebug(scroller: HTMLElement, platformKey: string) {
  // Keep one session across platform switches; every event is tagged with its platform.
  stopPlayDebug();
  platform = platformKey; root = scroller; platformsSeen.add(platformKey);
  const subs: Array<() => void> = [];
  cleanup = () => subs.forEach((f) => f());
  logDebug('platform_open', undefined, undefined, { platform, ua: navigator.userAgent, vw: innerWidth, vh: innerHeight });

  const onPointer = (e: Event) => {
    const target = e.target as Element;
    const p = e as PointerEvent;
    const { rank, postId } = rankOf(target);
    logDebug(e.type, rank, postId, { target: describe(target), x: Math.round(p.clientX ?? 0), y: Math.round(p.clientY ?? 0) });
  };
  ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].forEach((ev) => {
    document.addEventListener(ev, onPointer, { capture: true, passive: true });
    subs.push(() => document.removeEventListener(ev, onPointer, { capture: true } as any));
  });

  // Window blur while an iframe is focused = the tap went INTO the embed.
  const onBlur = () => setTimeout(() => {
    const a = document.activeElement;
    const { rank, postId } = rankOf(a);
    logDebug('window_blur', rank, postId, { active: describe(a), iframe: a instanceof HTMLIFrameElement ? iframeHost(a) : null });
  }, 0);
  const onFocus = () => logDebug('window_focus');
  window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus);
  subs.push(() => { window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); });

  let lastActive: Element | null = null;
  const focusPoll = setInterval(() => {
    const a = document.activeElement;
    if (a !== lastActive) {
      lastActive = a;
      const { rank, postId } = rankOf(a);
      logDebug('active_element', rank, postId, { active: describe(a), iframe: a instanceof HTMLIFrameElement ? iframeHost(a) : null });
    }
  }, 100);
  subs.push(() => clearInterval(focusPoll));

  // Confirmed plays (generation bumps) per mounted post.
  const gens = new Map<string, number>();
  const genPoll = setInterval(() => {
    scroller.querySelectorAll<HTMLElement>('[data-debug-post-id]').forEach((n) => {
      const id = n.dataset.debugPostId!;
      const g = getPostPlaybackGeneration(id);
      const prev = gens.get(id) ?? 0;
      if (g !== prev) { gens.set(id, g); logDebug('play_confirmed', Number(n.dataset.debugRank), id, { generation: g }); }
    });
  }, 150);
  subs.push(() => clearInterval(genPoll));

  // Scroll (throttled) — movement inside 180ms of a tap cancels play confirmation.
  let lastScrollLog = 0;
  const onScroll = (e: Event) => {
    const n = Date.now();
    if (n - lastScrollLog < 120) return;
    lastScrollLog = n;
    const tgt = e.target as HTMLElement;
    logDebug('scroll', currentRank(), undefined, { top: Math.round(tgt?.scrollTop ?? window.scrollY), inViewer: tgt === scroller });
  };
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  subs.push(() => document.removeEventListener('scroll', onScroll, { capture: true } as any));

  // Media element events (direct video posts).
  const mediaEvents = ['play', 'playing', 'pause', 'waiting', 'ended', 'error', 'stalled'];
  const onMedia = (e: Event) => { const { rank, postId } = rankOf(e.target as Element); logDebug('media_' + e.type, rank, postId); };
  mediaEvents.forEach((ev) => { document.addEventListener(ev, onMedia, true); subs.push(() => document.removeEventListener(ev, onMedia, true)); });

  // Iframe loads (capture works for non-bubbling load).
  const onLoad = (e: Event) => {
    if (!(e.target instanceof HTMLIFrameElement)) return;
    const { rank, postId } = rankOf(e.target);
    const n = postId ? (loadCount.get(postId) ?? 0) + 1 : 0;
    if (postId) loadCount.set(postId, n);
    logDebug(n <= 1 ? 'iframe_first_load' : 'iframe_reload', rank, postId, { host: iframeHost(e.target), loadNo: n });
  };
  scroller.addEventListener('load', onLoad, true);
  subs.push(() => scroller.removeEventListener('load', onLoad, true));

  // Iframe mount/unmount + src / visibility changes (suspend / reload).
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => scanIframes(n, 'iframe_added', m.target as Element));
        m.removedNodes.forEach((n) => scanIframes(n, 'iframe_removed', m.target as Element));
      } else if (m.type === 'attributes' && m.target instanceof HTMLIFrameElement) {
        const { rank, postId } = rankOf(m.target);
        const f = m.target;
        logDebug('iframe_attr', rank, postId, { attr: m.attributeName, host: iframeHost(f), style: f.getAttribute('style')?.slice(0, 120), pe: getComputedStyle(f).pointerEvents });
      }
    }
  });
  mo.observe(scroller, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style', 'class', 'sandbox'] });
  subs.push(() => mo.disconnect());

  // Messages coming back from embedded players.
  const onMsg = (e: MessageEvent) => {
    let data = '';
    try { data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data); } catch { data = '[unserializable]'; }
    let host = ''; try { host = new URL(e.origin).host; } catch { host = e.origin; }
    let rank: number | undefined; let postId: string | undefined;
    scroller.querySelectorAll('iframe').forEach((f) => { if (f.contentWindow === e.source) ({ rank, postId } = rankOf(f)); });
    logDebug('message', rank, postId, { origin: host, data: data.slice(0, 200) });
  };
  window.addEventListener('message', onMsg);
  subs.push(() => window.removeEventListener('message', onMsg));

  // Main-thread stalls + frame rate: a frozen/buffering player inside an iframe
  // often coincides with the page hogging the CPU or many live players decoding.
  try {
    const po = new PerformanceObserver((list) => {
      list.getEntries().forEach((en) => {
        recentLong.push(Date.now());
        logDebug('long_task', currentRank(), undefined, { ms: Math.round(en.duration) });
      });
    });
    po.observe({ type: 'longtask', buffered: false } as any);
    subs.push(() => po.disconnect());
  } catch { /* unsupported */ }
  let frames = 0; let raf = 0; let alive = true;
  const loop = () => { frames++; if (alive) raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  const fpsTick = setInterval(() => {
    lastFps = frames; frames = 0;
    const live = scroller.querySelectorAll('iframe[src]:not([src=""]),video').length;
    logDebug('perf', currentRank(), undefined, { fps: lastFps, liveMedia: live });
  }, 1000);
  subs.push(() => { alive = false; cancelAnimationFrame(raf); clearInterval(fpsTick); });

  const onVis = () => logDebug('visibility', undefined, undefined, { state: document.visibilityState });
  document.addEventListener('visibilitychange', onVis);
  subs.push(() => document.removeEventListener('visibilitychange', onVis));

  // ===== Extended capture (read-only additions) =====
  // Snapshot full config of iframes already mounted when the session starts.
  scroller.querySelectorAll('iframe').forEach((f) => { const r = rankOf(f); logDebug('iframe_config', r.rank, r.postId, { reason: 'session_start', ...iframeConfig(f) }); });

  // Play attempts: started by a tap on the post (parent document) OR by focus
  // moving into the post's iframe (taps inside cross-origin iframes never reach
  // the parent document, so window blur is the only observable tap signal).
  const onTapDown = (e: Event) => {
    const { rank, postId } = rankOf(e.target as Element);
    if (postId) startAttempt(rank, postId, e.type);
  };
  document.addEventListener('pointerdown', onTapDown, { capture: true, passive: true });
  subs.push(() => document.removeEventListener('pointerdown', onTapDown, { capture: true } as any));
  const onBlurAttempt = () => setTimeout(() => {
    const a = document.activeElement;
    if (!(a instanceof HTMLIFrameElement)) return;
    const { rank, postId } = rankOf(a);
    if (postId) startAttempt(rank, postId, 'iframe_focus');
  }, 0);
  window.addEventListener('blur', onBlurAttempt);
  subs.push(() => window.removeEventListener('blur', onBlurAttempt));

  // First player message after a tap, per attempt.
  const onMsgAttempt = (e: MessageEvent) => {
    let postId: string | undefined;
    scroller.querySelectorAll('iframe').forEach((f) => { if (f.contentWindow === e.source) postId = rankOf(f).postId; });
    if (!postId) return;
    const a = attempts.get(postId);
    if (a && a.firstMessageT == null) {
      a.firstMessageT = now();
      let data = ''; try { data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data); } catch { data = '[unserializable]'; }
      a.firstMessageData = data.slice(0, 120);
    }
  };
  window.addEventListener('message', onMsgAttempt);
  subs.push(() => window.removeEventListener('message', onMsgAttempt));

  // Owned <video> 'playing' event counts as observable playback for that attempt.
  const onPlaying = (e: Event) => {
    const { postId } = rankOf(e.target as Element);
    const a = postId ? attempts.get(postId) : undefined;
    if (a && a.firstMediaPlayingT == null) a.firstMediaPlayingT = now();
  };
  document.addEventListener('playing', onPlaying, true);
  subs.push(() => document.removeEventListener('playing', onPlaying, true));

  // Generation change watcher dedicated to attempts (separate from the
  // existing play_confirmed poll, which is left untouched).
  const attemptGenPoll = setInterval(() => {
    attempts.forEach((a) => {
      if (a.done) return;
      const g = getPostPlaybackGeneration(a.postId);
      if (g !== a.genAtTap && a.firstGenChangeT == null) {
        a.firstGenChangeT = now();
        a.genAfter = g;
        finishAttempt(a, true);
      }
    });
  }, 50);
  subs.push(() => clearInterval(attemptGenPoll));

  // Resource timing exposed to the page. Cross-origin resources loaded INSIDE
  // embeds (video segments, player JS) are NOT visible to the parent page;
  // only resources the parent itself loads (iframe document, SDK scripts).
  try {
    const ro = new PerformanceObserver((list) => {
      list.getEntries().forEach((en) => {
        const r = en as PerformanceResourceTiming;
        if (!isEmbedUrl(r.name)) return;
        logDebug('resource', currentRank(), undefined, {
          url: r.name.slice(0, 300),
          initiator: r.initiatorType,
          start: Math.round(r.startTime),
          duration: Math.round(r.duration),
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          decodedBodySize: r.decodedBodySize,
          responseStatus: (r as any).responseStatus ?? null,
          ttfb: r.responseStart > 0 ? Math.round(r.responseStart - r.startTime) : null,
          timingRestricted: r.responseStart === 0,
        });
      });
    });
    ro.observe({ type: 'resource', buffered: false } as any);
    subs.push(() => ro.disconnect());
  } catch { /* unsupported */ }

  // Runtime errors / rejections, filtered to embed/player-related ones.
  const onErr = (e: ErrorEvent) => {
    const text = `${e.message} ${e.filename ?? ''} ${(e.error as Error)?.stack ?? ''}`;
    const crossOrigin = e.message === 'Script error.' || (!e.filename && !e.lineno);
    if (!crossOrigin && !isEmbedRelated(text)) return;
    logDebug('runtime_error', currentRank(), undefined, { message: e.message?.slice(0, 200), file: e.filename?.slice(0, 200), line: e.lineno, col: e.colno, crossOriginOpaque: crossOrigin });
  };
  const onRej = (e: PromiseRejectionEvent) => {
    const r = e.reason as any;
    const text = `${r?.message ?? String(r)} ${r?.stack ?? ''}`;
    if (!isEmbedRelated(text)) return;
    logDebug('unhandled_rejection', currentRank(), undefined, { message: String(r?.message ?? r).slice(0, 200), stack: String(r?.stack ?? '').slice(0, 300) });
  };
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onRej);
  subs.push(() => { window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); });

  subs.push(() => { attempts.forEach((a) => a.timers.forEach(clearTimeout)); attempts.clear(); });
}

// ===== Extended capture helpers =====
const EMBED_HOSTS = /(twitter\.com|x\.com|twimg\.com|threads\.net|threads\.com|instagram\.com|cdninstagram\.com|facebook\.com|fbcdn\.net|fbsbx\.com|tiktok|youtube|ytimg|googlevideo|reddit|redd\.it|linkedin|licdn|pinterest|pinimg|spotify|scdn\.co|quora|vimeo)/i;
function isEmbedUrl(u: string) { try { return EMBED_HOSTS.test(new URL(u).host); } catch { return false; } }
function isEmbedRelated(text: string) { return EMBED_HOSTS.test(text) || /\b(iframe|embed|player|video|media)\b/i.test(text); }

export function iframeConfig(f: HTMLIFrameElement) {
  const src = f.getAttribute('src') ?? '';
  let query: Record<string, string> | null = null;
  try { const u = new URL(src, location.href); query = {}; u.searchParams.forEach((v, k) => { query![k] = v.slice(0, 200); }); } catch { /* no src */ }
  return {
    src: src.slice(0, 1000),
    srcdoc: f.hasAttribute('srcdoc'),
    sandbox: f.getAttribute('sandbox'),
    allow: f.getAttribute('allow'),
    loading: f.getAttribute('loading'),
    referrerpolicy: f.getAttribute('referrerpolicy'),
    allowfullscreen: f.hasAttribute('allowfullscreen'),
    widthAttr: f.getAttribute('width'),
    heightAttr: f.getAttribute('height'),
    query,
  };
}

function iframeGeometry(f: HTMLIFrameElement) {
  const b = f.getBoundingClientRect();
  const cs = getComputedStyle(f);
  const inView = b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth && b.width > 0 && b.height > 0;
  const visH = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0));
  return {
    x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
    display: cs.display, visibility: cs.visibility, opacity: cs.opacity, pointerEvents: cs.pointerEvents,
    position: cs.position, zIndex: cs.zIndex, transform: cs.transform,
    intersectsViewport: inView, visibleRatio: b.height ? +(visH / b.height).toFixed(2) : 0,
  };
}

function concurrency() {
  const scope = root ?? document.body;
  const vids = Array.from(scope.querySelectorAll('video'));
  return {
    liveIframes: scope.querySelectorAll('iframe[src]:not([src=""])').length,
    totalIframes: scope.querySelectorAll('iframe').length,
    ownedVideos: vids.length,
    ownedVideosPlaying: vids.filter((v) => !v.paused && !v.ended).length,
    ownedVideosAudible: vids.filter((v) => !v.paused && !v.ended && !v.muted && v.volume > 0).length,
    iframePlaybackObservable: false, // cross-origin players do not expose play/audio state
  };
}

interface Attempt {
  postId: string; rank?: number; trigger: string; tapT: number; genAtTap: number; genAfter?: number;
  firstMessageT?: number; firstMessageData?: string; firstMediaPlayingT?: number; firstGenChangeT?: number;
  done: boolean; timers: ReturnType<typeof setTimeout>[];
}
const attempts = new Map<string, Attempt>();
const lastAttemptResult = new Map<string, { confirmed: boolean; tapToConfirmMs: number | null }>();
const ATTEMPT_TIMEOUT_MS = 10000;

function startAttempt(rank: number | undefined, postId: string, trigger: string) {
  const prev = attempts.get(postId);
  if (prev && !prev.done && now() - prev.tapT < 600) return; // same physical tap (pointerdown + blur)
  if (prev && !prev.done) finishAttempt(prev, false, 'superseded');
  const host = root?.querySelector<HTMLElement>(`[data-debug-post-id="${postId}"]`);
  const frames = host ? Array.from(host.querySelectorAll('iframe')) : [];
  const a: Attempt = { postId, rank, trigger, tapT: now(), genAtTap: getPostPlaybackGeneration(postId), done: false, timers: [] };
  attempts.set(postId, a);
  logDebug('play_attempt_start', rank, postId, {
    trigger, genAtTap: a.genAtTap,
    iframes: frames.map((f) => ({ ...iframeConfig(f), ...iframeGeometry(f) })),
    concurrency: concurrency(),
  });
  [1000, 3000].forEach((ms) => a.timers.push(setTimeout(() => {
    if (!a.done) logDebug('play_attempt_sample', rank, postId, { msSinceTap: ms, concurrency: concurrency() });
  }, ms)));
  a.timers.push(setTimeout(() => { if (!a.done) finishAttempt(a, false, 'timeout'); }, ATTEMPT_TIMEOUT_MS));
}

function finishAttempt(a: Attempt, confirmed: boolean, reason = 'generation_change') {
  a.done = true;
  a.timers.forEach(clearTimeout);
  const rel = (t?: number) => (t == null ? null : t - a.tapT);
  const tapToConfirmMs = confirmed ? rel(a.firstGenChangeT) : null;
  lastAttemptResult.set(a.postId, { confirmed, tapToConfirmMs });
  logDebug('play_attempt_result', a.rank, a.postId, {
    trigger: a.trigger, confirmed, reason, tapT: a.tapT,
    tapToFirstMessageMs: rel(a.firstMessageT), firstMessageData: a.firstMessageData ?? null,
    tapToMediaPlayingMs: rel(a.firstMediaPlayingT),
    tapToPlayConfirmedMs: tapToConfirmMs, tapToGenerationChangeMs: tapToConfirmMs,
    genAtTap: a.genAtTap, genAfter: a.genAfter ?? null,
    concurrency: concurrency(),
  });
}

function scanIframes(node: Node, type: string, parent: Element) {
  if (!(node instanceof Element)) return;
  const frames = node instanceof HTMLIFrameElement ? [node] : Array.from(node.querySelectorAll('iframe'));
  frames.forEach((f) => {
    const { rank, postId } = rankOf(type === 'iframe_removed' ? parent : f);
    let mountNo: number | undefined;
    if (type === 'iframe_added' && postId) { mountNo = (mountCount.get(postId) ?? 0) + 1; mountCount.set(postId, mountNo); }
    logDebug(mountNo && mountNo > 1 ? 'iframe_remount' : type, rank, postId, { host: iframeHost(f), mountNo });
  });
}

/** Rank of the post closest to the vertical centre of the viewer. */
export function currentRank(): number | undefined {
  if (!root) return undefined;
  const r = root.getBoundingClientRect();
  const mid = r.top + r.height / 2;
  let best: { d: number; rank: number } | null = null;
  root.querySelectorAll<HTMLElement>('[data-debug-rank]').forEach((n) => {
    const b = n.getBoundingClientRect();
    const d = b.top <= mid && b.bottom >= mid ? 0 : Math.min(Math.abs(b.top - mid), Math.abs(b.bottom - mid));
    if (!best || d < best.d) best = { d, rank: Number(n.dataset.debugRank) };
  });
  return (best as { rank: number } | null)?.rank;
}

export function addDebugLabel(rank: number, verdict: DebugVerdict) {
  const host = root?.querySelector<HTMLElement>(`[data-debug-rank="${rank}"]`);
  const postId = host?.dataset.debugPostId;
  const label: DebugLabel = { t: now(), p: platform, rank, postId, verdict, loads: postId ? loadCount.get(postId) ?? 0 : undefined, mounts: postId ? mountCount.get(postId) ?? 0 : undefined, liveIframes: root?.querySelectorAll('iframe[src]:not([src=""])').length, longTasks5s: recentLong.filter((x) => Date.now() - x < 5000).length, fps: lastFps };
  labels.push(label);
  logDebug('user_label', rank, label.postId, { verdict });
}

export function getDebugCounts() { return { events: events.length, labels: labels.length }; }

export async function saveDebugSession(): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false, error: 'Sign in to save' };
  const { error } = await supabase.from('play_debug_sessions').insert({
    user_id: session.user.id,
    platform: Array.from(platformsSeen).join(','),
    user_agent: navigator.userAgent,
    labels: labels as any,
    events: events as any,
  });
  if (error) return { ok: false, error: error.message };
  events = []; labels = []; t0 = Date.now(); loadCount.clear(); mountCount.clear(); platformsSeen.clear(); platformsSeen.add(platform);
  return { ok: true };
}

export function stopPlayDebug() {
  cleanup?.();
  cleanup = null;
}
