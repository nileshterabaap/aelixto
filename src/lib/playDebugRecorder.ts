import { supabase } from '@/integrations/supabase/client';
import { getPostPlaybackGeneration } from '@/lib/playedPosts';

/**
 * Hidden diagnostic recorder for the profile grid viewer. Watches (never
 * changes) taps, iframe focus, scroll, iframe mounts/loads, media events,
 * player messages and confirmed-play generations, tagged with grid rank.
 */
export interface DebugEvent { t: number; type: string; rank?: number; postId?: string; d?: Record<string, unknown> }
export interface DebugLabel { t: number; rank: number; postId?: string; verdict: 'worked' | 'not_worked' }

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
  events.push({ t: now(), type, rank, postId, d });
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
  stopPlayDebug();
  events = []; labels = []; t0 = Date.now(); platform = platformKey; root = scroller;
  const subs: Array<() => void> = [];
  cleanup = () => subs.forEach((f) => f());
  logDebug('session_start', undefined, undefined, { platform, ua: navigator.userAgent, vw: innerWidth, vh: innerHeight });

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
    logDebug('iframe_load', rank, postId, { host: iframeHost(e.target) });
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

  const onVis = () => logDebug('visibility', undefined, undefined, { state: document.visibilityState });
  document.addEventListener('visibilitychange', onVis);
  subs.push(() => document.removeEventListener('visibilitychange', onVis));
}

function scanIframes(node: Node, type: string, parent: Element) {
  if (!(node instanceof Element)) return;
  const frames = node instanceof HTMLIFrameElement ? [node] : Array.from(node.querySelectorAll('iframe'));
  frames.forEach((f) => {
    const { rank, postId } = rankOf(type === 'iframe_removed' ? parent : f);
    logDebug(type, rank, postId, { host: iframeHost(f) });
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

export function addDebugLabel(rank: number, verdict: DebugLabel['verdict']) {
  const host = root?.querySelector<HTMLElement>(`[data-debug-rank="${rank}"]`);
  const label = { t: now(), rank, postId: host?.dataset.debugPostId, verdict };
  labels.push(label);
  logDebug('user_label', rank, label.postId, { verdict });
}

export function getDebugCounts() { return { events: events.length, labels: labels.length }; }

export async function saveDebugSession(): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { ok: false, error: 'Sign in to save' };
  const { error } = await supabase.from('play_debug_sessions').insert({
    user_id: session.user.id,
    platform,
    user_agent: navigator.userAgent,
    labels: labels as any,
    events: events as any,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function stopPlayDebug() {
  cleanup?.();
  cleanup = null;
}
