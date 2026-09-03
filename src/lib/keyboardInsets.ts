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

function apply(height: number) {
  const root = document.documentElement;
  let value = Math.max(0, height);

  // Android's Keyboard plugin reports the keyboard height in PHYSICAL pixels on
  // some devices/WebViews, while CSS works in density-independent pixels. On a
  // 2.75x device a ~350dp keyboard arrives as ~960 — subtracting that from
  // 100dvh collapses the whole screen (blank chat, composer stuck under the
  // header). Normalise anything that is implausibly tall for a keyboard.
  const viewportH = window.innerHeight || 0;
  const dpr = window.devicePixelRatio || 1;
  if (viewportH > 0 && dpr > 1 && value > viewportH * 0.75) {
    value = value / dpr;
  }
  // Hard safety net: a keyboard never legitimately covers more than 70% of the
  // viewport; clamping keeps the layout usable even if the report is bogus.
  if (viewportH > 0) value = Math.min(value, viewportH * 0.7);

  const px = Math.max(0, Math.round(value));
  root.style.setProperty('--kb', `${px}px`);
  root.classList.toggle('kb-open', px > 0);
}


let started = false;

export function initKeyboardInsets() {
  if (started) return;
  started = true;
  apply(0);

  if (Capacitor.isNativePlatform()) {
    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        await Keyboard.addListener('keyboardWillShow', (info) => apply(info.keyboardHeight));
        await Keyboard.addListener('keyboardDidShow', (info) => apply(info.keyboardHeight));
        await Keyboard.addListener('keyboardWillHide', () => apply(0));
        await Keyboard.addListener('keyboardDidHide', () => apply(0));
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
    apply(overlap > 80 ? overlap : 0);
  };
  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
}
