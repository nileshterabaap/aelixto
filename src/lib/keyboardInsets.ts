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
  const px = Math.max(0, Math.round(height));
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
