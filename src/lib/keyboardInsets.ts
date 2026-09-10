/**
 * Keyboard state tracking (Aug-24 behaviour restored).
 *
 * The soft keyboard is handled natively: Android resizes the WebView, so the
 * visible viewport already ends exactly at the top of the keyboard. The app
 * therefore performs NO keyboard math — `--kb` stays `0px` forever and is kept
 * only so existing `calc(... - var(--kb))` expressions stay valid.
 *
 * The single thing tracked here is whether the keyboard is open, exposed as
 * `html.kb-open`, so the bottom tab bar hides and the bottom safe inset
 * collapses while typing (the keyboard covers the system nav bar).
 */

import { Capacitor } from '@capacitor/core';

function setOpen(open: boolean) {
  document.documentElement.classList.toggle('kb-open', open);
}

let started = false;

export function initKeyboardInsets() {
  if (started) return;
  started = true;
  document.documentElement.style.setProperty('--kb', '0px');
  setOpen(false);

  if (Capacitor.isNativePlatform()) {
    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        await Keyboard.addListener('keyboardWillShow', () => setOpen(true));
        await Keyboard.addListener('keyboardDidShow', () => setOpen(true));
        await Keyboard.addListener('keyboardWillHide', () => setOpen(false));
        await Keyboard.addListener('keyboardDidHide', () => setOpen(false));
      } catch (error) {
        console.warn('[keyboard] plugin listeners unavailable', error);
      }
    })();
    return;
  }

  // Web / PWA: visualViewport shrinks when the on-screen keyboard opens.
  const vv = window.visualViewport;
  if (!vv) return;
  const onResize = () => {
    const overlap = window.innerHeight - (vv.height + vv.offsetTop);
    setOpen(overlap > 80);
  };
  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
}
