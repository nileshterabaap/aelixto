import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

type RouteKey = string;

type Anchor = {
  /** The post that was at/near the top of the viewport */
  id: string;
  /** How far the viewport top was inside that post element (px) */
  offsetWithin: number;
};

// In-memory cache (persists across route unmount/mount within a session)
const anchors = new Map<RouteKey, Anchor>();

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Feed-specific restoration that is resilient to dynamic content height changes.
 *
 * Instead of restoring a raw scrollY (which shifts when images/embeds load),
 * we store the topmost visible item id + an offset, then scroll to that element.
 */
export const useFeedAnchorRestoration = (routeKey: RouteKey, itemIds: string[]) => {
  const elByIdRef = useRef(new Map<string, HTMLElement>());
  const rafScheduled = useRef(false);
  const hasRestored = useRef(false);

  const idsSet = useMemo(() => new Set(itemIds), [itemIds]);

  const registerItem = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (!id) return;
      if (el) elByIdRef.current.set(id, el);
      else elByIdRef.current.delete(id);
    },
    []
  );

  const snapshotAnchor = useCallback(() => {
    const entries: Array<{ id: string; top: number; height: number }> = [];

    for (const [id, el] of elByIdRef.current.entries()) {
      if (!idsSet.has(id)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 1) continue;
      entries.push({ id, top: rect.top, height: rect.height });
    }

    if (entries.length === 0) return;

    // Prefer the item intersecting near the top (accounts for sticky header)
    const topBand = 64;
    const intersecting = entries
      .filter((e) => e.top <= topBand && e.top + e.height > topBand)
      .sort((a, b) => Math.abs(a.top) - Math.abs(b.top))[0];

    const best =
      intersecting ??
      entries
        .slice()
        .sort((a, b) => {
          // Prefer items below top; if both above, pick the closer one.
          const da = a.top >= 0 ? a.top : 10000 + Math.abs(a.top);
          const db = b.top >= 0 ? b.top : 10000 + Math.abs(b.top);
          return da - db;
        })[0];

    const el = elByIdRef.current.get(best.id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const offsetWithin = clamp(-rect.top, 0, Math.max(0, rect.height - 1));
    anchors.set(routeKey, { id: best.id, offsetWithin });
  }, [idsSet, routeKey]);

  // Continuously snapshot (throttled to rAF) while this route is mounted
  useEffect(() => {
    const onScroll = () => {
      if (rafScheduled.current) return;
      rafScheduled.current = true;
      requestAnimationFrame(() => {
        rafScheduled.current = false;
        snapshotAnchor();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      snapshotAnchor();
    };
  }, [snapshotAnchor]);

  // Restore once items exist.
  useLayoutEffect(() => {
    if (hasRestored.current) return;
    const anchor = anchors.get(routeKey);
    if (!anchor) return;
    if (!itemIds.includes(anchor.id)) return;

    const attempt = () => {
      const el = elByIdRef.current.get(anchor.id);
      if (!el) return false;

      const topInPage = el.getBoundingClientRect().top + window.scrollY;
      const targetY = Math.max(0, topInPage + anchor.offsetWithin);
      window.scrollTo(0, targetY);
      return true;
    };

    if (attempt()) {
      hasRestored.current = true;
      // Re-apply a few times as images/embeds settle
      const delays = [0, 50, 150, 350, 700];
      delays.forEach((delay) => setTimeout(() => attempt(), delay));
    }
  }, [itemIds, routeKey]);

  return {
    registerItem,
    snapshotAnchor,
  };
};
