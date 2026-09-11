/**
 * Keyboard state tracking.
 *
 * Device measurements show Android already resizes the WebView for the IME
 * (innerHeight 716 -> 417). Native layout therefore follows that resized
 * viewport and never subtracts the keyboard height again. Keyboard events only
 * toggle `kb-open`, which hides the tab bar and collapses the bottom safe inset.
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
    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        const onShow = () => set(0, true);
        const onHide = () => set(0, false);
        await Keyboard.addListener('keyboardWillShow', onShow);
        await Keyboard.addListener('keyboardDidShow', onShow);
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
