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

function set(px: number) {
  const root = document.documentElement;
  const value = Math.max(0, Math.round(px));
  root.style.setProperty('--kb', `${value}px`);
  root.classList.toggle('kb-open', value > 0);
}

let started = false;

export function initKeyboardInsets() {
  if (started) return;
  started = true;
  set(0);

  if (Capacitor.isNativePlatform()) {
    // Device measurements (Sep 2026) show the Android WebView DOES shrink when
    // the IME opens (innerHeight 716 -> 417) even with `resize: none`, because
    // the activity runs edge-to-edge with adjustResize. Subtracting the plugin
    // reported keyboard height on top of that double-counts the keyboard and
    // collapses the chat to ~125px. So on native the WebView height is the
    // single source of truth: --kb stays 0 whenever the viewport already
    // shrank, and only compensates the leftover gap if it did not.
    let baseline = window.innerHeight;

    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        const onShow = (reported: number) => {
          // Give the WebView a frame to settle into its resized height.
          window.setTimeout(() => {
            const shrink = Math.max(0, baseline - window.innerHeight);
            const kb = Math.max(0, Math.min(reported, window.innerHeight * 0.7));
            // Viewport already absorbed (most of) the keyboard -> nothing to do.
            set(shrink > 80 ? 0 : kb);
          }, 60);
        };
        const onHide = () => {
          set(0);
          window.setTimeout(() => {
            baseline = Math.max(baseline, window.innerHeight);
          }, 120);
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
