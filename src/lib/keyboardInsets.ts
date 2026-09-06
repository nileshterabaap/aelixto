/**
 * Keyboard inset tracking.
 *
 * The Android WebView runs edge-to-edge (`overlaysWebView: true`), and letting
 * Android resize the WebView for the soft keyboard produced broken layouts:
 * pages laid out against a stale `100vh`, huge blank bands, and the composer
 * floating in the middle of the screen. Instead the keyboard is configured to
 * NOT resize the WebView (`Keyboard.resize = 'none'`) and the app reports the
 * keyboard height itself as a CSS variable:
 *
 *   --kb        keyboard height in px (0 when closed)
 *   html.kb-open  present while the keyboard is visible
 *
 * Layouts that must sit above the keyboard use `calc(100dvh - var(--kb))`.
 */

import { Capacitor } from '@capacitor/core';

function set(px: number, open = px > 0) {
  const root = document.documentElement;
  const value = Math.max(0, Math.round(px));
  root.style.setProperty('--kb', `${value}px`);
  root.classList.toggle('kb-open', open);
}

let started = false;

export function initKeyboardInsets() {
  if (started) return;
  started = true;
  set(0);

  if (Capacitor.isNativePlatform()) {
    // Device measurements: the Android WebView DOES shrink when the IME opens
    // (innerHeight 716 -> 417). So the WebView height is the SINGLE owner of
    // keyboard positioning — `100dvh` already excludes the keyboard. Any extra
    // subtraction double-counts it (that produced the gap between the composer
    // and the keyboard, and earlier the collapsed chat). --kb therefore stays
    // 0 on native; we only flag `kb-open` so the bottom safe inset and the tab
    // bar collapse while typing.
    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        await Keyboard.addListener('keyboardWillShow', () => set(0, true));
        await Keyboard.addListener('keyboardDidShow', () => set(0, true));
        await Keyboard.addListener('keyboardWillHide', () => set(0, false));
        await Keyboard.addListener('keyboardDidHide', () => set(0, false));
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
