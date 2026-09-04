/**
 * Keyboard inset tracking.
 *
 * Two CSS hooks are maintained for layouts that must sit above the keyboard:
 *
 *   --kb          extra keyboard height in px the WebView did NOT absorb
 *   html.kb-open  present while the keyboard is visible
 *
 * Native (Android, edge-to-edge + @capacitor-community/safe-area):
 *   The safe-area plugin pads the decor view by the IME inset, so the WebView
 *   itself shrinks by the full keyboard height (measured: 716 -> 417). The
 *   resized WebView is therefore the single owner of keyboard positioning and
 *   --kb must stay 0. While the keyboard is open the plugin keeps passing the
 *   navigation-bar inset through to env(safe-area-inset-bottom) even though the
 *   WebView no longer extends under the nav bar — `html.kb-open` collapses
 *   `--safe-bottom` to 0 so composers don't float a nav-bar height above the
 *   keyboard. That is why kb-open is derived from the WebView shrinking itself
 *   (window resize) and not only from plugin events.
 *
 * Web / PWA: the WebView does not shrink; visualViewport reports the overlap
 * and --kb compensates it.
 */

import { Capacitor } from '@capacitor/core';

const DEBUG_KEY = 'aelixto:kbdebug';
let lastReported = 0;

function set(px: number, open = px > 0) {
  const root = document.documentElement;
  const value = Math.max(0, Math.round(px));
  root.style.setProperty('--kb', `${value}px`);
  root.classList.toggle('kb-open', open);
  renderDebug();
}

let started = false;

export function initKeyboardInsets() {
  if (started) return;
  started = true;
  set(0);

  if (Capacitor.isNativePlatform()) {
    // Largest height seen with the keyboard closed. Re-armed on every hide so
    // an early (pre-inset) measurement can never poison the comparison.
    let baseline = window.innerHeight;
    let pluginOpen = false;

    const editableFocused = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const apply = () => {
      const h = window.innerHeight;
      const shrink = Math.max(0, baseline - h);
      const shrunk = shrink > 120;
      // Stateless third signal: an editable is focused AND the WebView is far
      // shorter than the physical screen. Can't be poisoned by event order.
      const focusedShort = editableFocused() && h < (window.screen?.height ?? Infinity) * 0.75;
      const open = shrunk || pluginOpen || focusedShort;
      // WebView absorbed the keyboard -> nothing to compensate. Only when it
      // did NOT shrink (rare WebView builds) do we use the plugin height.
      const kb = shrunk || focusedShort ? 0 : pluginOpen ? Math.min(lastReported, h * 0.7) : 0;
      set(kb, open);
      if (!open) baseline = Math.max(baseline, h);
    };

    // Plugin-independent detection: the WebView resizing IS the keyboard.
    window.addEventListener('resize', () => {
      const h = window.innerHeight;
      if (!pluginOpen && h > baseline) baseline = h;
      apply();
    });
    // Focus moves (composer <-> nothing) re-evaluate immediately and again
    // once the WebView has had a frame to resize.
    const onFocusChange = () => { apply(); window.setTimeout(apply, 100); window.setTimeout(apply, 300); };
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);

    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        const onShow = (reported: number) => {
          pluginOpen = true;
          lastReported = reported;
          apply();
          // Give the WebView a beat to settle into its resized height.
          window.setTimeout(apply, 80);
        };
        const onHide = () => {
          pluginOpen = false;
          lastReported = 0;
          apply();
          window.setTimeout(apply, 120);
        };
        await Keyboard.addListener('keyboardWillShow', (i) => onShow(i.keyboardHeight));
        await Keyboard.addListener('keyboardDidShow', (i) => onShow(i.keyboardHeight));
        await Keyboard.addListener('keyboardWillHide', onHide);
        await Keyboard.addListener('keyboardDidHide', onHide);
      } catch (error) {
        console.warn('[keyboard] plugin listeners unavailable', error);
      }
    })();
    return;
  }

  // Web / PWA fallback: visualViewport shrinks when the on-screen keyboard opens.
  const vv = window.visualViewport;
  if (!vv) return;
  const onResize = () => {
    const overlap = window.innerHeight - (vv.height + vv.offsetTop);
    set(overlap > 80 ? overlap : 0);
  };
  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
}

/* ----------------------------------------------------------------------------
 * Opt-in on-screen readout (Settings → "Layout debug"). Pure DOM, no layout
 * impact (fixed, pointer-events none). Shows the values that decide where the
 * chat composer lands so device issues can be read off a screenshot.
 * ------------------------------------------------------------------------- */

export function isKeyboardDebugEnabled() {
  try { return localStorage.getItem(DEBUG_KEY) === '1'; } catch { return false; }
}

export function setKeyboardDebugEnabled(on: boolean) {
  try { on ? localStorage.setItem(DEBUG_KEY, '1') : localStorage.removeItem(DEBUG_KEY); } catch {}
  renderDebug();
}

let debugEl: HTMLDivElement | null = null;
let debugTimer: number | null = null;

function renderDebug() {
  if (typeof document === 'undefined') return;
  if (!isKeyboardDebugEnabled()) {
    debugEl?.remove();
    debugEl = null;
    if (debugTimer) { window.clearInterval(debugTimer); debugTimer = null; }
    return;
  }
  if (!debugEl) {
    debugEl = document.createElement('div');
    debugEl.setAttribute('aria-hidden', 'true');
    debugEl.style.cssText =
      'position:fixed;top:calc(var(--safe-top,0px) + 56px);right:6px;z-index:2147483647;pointer-events:none;' +
      'font:10px/1.35 ui-monospace,monospace;background:rgba(0,0,0,.72);color:#fff;padding:6px 8px;border-radius:8px;white-space:pre;';
    document.body.appendChild(debugEl);
    debugTimer = window.setInterval(renderDebug, 500);
  }
  const cs = getComputedStyle(document.documentElement);
  const composer = document.querySelector('[data-kbdebug="composer"]');
  const rect = composer?.getBoundingClientRect();
  const composerGap = rect ? Math.round(window.innerHeight - rect.bottom) : null;
  const composerPad = composer ? getComputedStyle(composer).paddingBottom : '-';
  debugEl.textContent =
    `DEBUG ONLY\n` +
    `innerH ${window.innerHeight}  vv ${Math.round(window.visualViewport?.height ?? 0)}\n` +
    `plugin ${lastReported}  --kb ${cs.getPropertyValue('--kb').trim()}\n` +
    `kb-open ${document.documentElement.classList.contains('kb-open')}\n` +
    `--safe-bottom ${cs.getPropertyValue('--safe-bottom').trim()}\n` +
    `composer pad-b ${composerPad}  gap ${composerGap ?? '-'}px`;
}
