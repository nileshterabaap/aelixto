import { useEffect } from 'react';

/**
 * Global Threads-only navigation lock.
 *
 * Threads embed iframes (www.threads.net / threads.com) are otherwise free
 * to top-navigate the app when a user taps a link inside the embed (author
 * handle, tags, "View on Threads"). This mirrors the sandbox approach used
 * for X / Pinterest / Spotify: allow scripts + same-origin + presentation
 * so the native Threads player, postMessage sizing, and video playback keep
 * working, but omit allow-popups / allow-top-navigation* so any link tap
 * inside the embed is silently dropped by the browser.
 *
 * Runs at the App root so it's decoupled from any platform-guarded file
 * and covers Threads iframes injected by the SDK anywhere in the tree
 * (feed, PostDetail, Profile grid viewer, Saved viewer, DM previews).
 * Does not touch scoring, image_view, video_play, or original_visit paths.
 */
export function useThreadsNavLock() {
  useEffect(() => {
    const applyLock = (iframe: HTMLIFrameElement) => {
      if (iframe.dataset.threadsNavLock === '1') return;
      const src = (iframe.getAttribute('src') || '').toLowerCase();
      if (!src.includes('threads.net') && !src.includes('threads.com')) return;
      iframe.dataset.threadsNavLock = '1';
      iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-presentation',
      );
    };

    const scan = (root: ParentNode) => {
      root
        .querySelectorAll<HTMLIFrameElement>(
          'iframe[src*="threads.net"], iframe[src*="threads.com"]',
        )
        .forEach(applyLock);
    };

    scan(document);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLIFrameElement) {
            applyLock(node);
          } else if (node instanceof HTMLElement) {
            scan(node);
          }
        }
        if (
          m.type === 'attributes' &&
          m.target instanceof HTMLIFrameElement &&
          m.attributeName === 'src'
        ) {
          // Reset guard so a swapped-in Threads URL re-locks.
          if (m.target.dataset.threadsNavLock === '1') {
            const src = (m.target.getAttribute('src') || '').toLowerCase();
            if (!src.includes('threads.net') && !src.includes('threads.com')) {
              delete m.target.dataset.threadsNavLock;
            }
          }
          applyLock(m.target);
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });

    return () => observer.disconnect();
  }, []);
}