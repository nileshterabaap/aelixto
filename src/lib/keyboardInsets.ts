/**
 * Keyboard state tracking.
 *
 * Android: device measurements show the WebView is already resized for the
 * IME (innerHeight 716 -> 417), so `--kb` stays 0 and keyboard events only
 * toggle `kb-open` (hides the tab bar, collapses the bottom safe inset).
 *
 * iPhone: the Keyboard plugin's `resize: "none"` (an iOS-only setting) keeps
 * the WebView full height, so the keyboard covers the bottom of the page. On
 * iOS we therefore set `--kb` to the reported keyboard height so composers sit
 * on top of it, the same way the website does with visualViewport.
 */

import { Capacitor } from '@capacitor/core';

function set(px: number, open = px > 0) {
  const root = document.documentElement;
  const value = Math.max(0, Math.round(px));
  root.style.setProperty('--kb', `${value}px`);
  root.classList.toggle('kb-open', open);
}

/** iOS nudges the whole page up to reveal a focused field; undo it once our own offset applies. */
function resetIosPageScroll() {
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  });
}

let started = false;

export function initKeyboardInsets() {
  if (started) return;
  started = true;
  set(0);

  if (Capacitor.isNativePlatform()) {
    const isIos = Capacitor.getPlatform() === 'ios';
    void (async () => {
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        const onShow = (info?: { keyboardHeight?: number }) => {
          if (isIos) {
            set(info?.keyboardHeight ?? 0, true);
            resetIosPageScroll();
          } else {
            set(0, true);
          }
        };
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
