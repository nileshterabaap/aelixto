import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { PostSkeleton } from "@/components/PostSkeleton";
import { nextBlockIndex } from "./blockNavigation";
import { logDebug } from "@/lib/playDebugRecorder";

interface Props {
  postIds: string[];
  initialIndex: number;
  scrollRef: RefObject<HTMLDivElement>;
  renderPost: (index: number) => ReactNode;
  /** True when the post carries playable media. Only those wait for landing. */
  isVideo?: (index: number) => boolean;
}

/** Empty neighbours carry scroll motion; only the landed post owns a player.
 *  Image/text posts mount immediately — the land-to-load delay exists only
 *  to give video players a fresh mount, so static posts never pay for it. */
export function PlatformBlockPosts({ postIds, initialIndex, scrollRef, renderPost, isVideo }: Props) {
  const [selected, setSelected] = useState(Math.max(0, initialIndex));
  const selectedRef = useRef(selected);
  const slots = useRef(new Map<number, HTMLDivElement>());
  const [viewportHeight, setViewportHeight] = useState(0);
  const busyUntil = useRef(0);
  const programmaticTarget = useRef<number | null>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const measure = () => setViewportHeight(container.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scrollRef]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    const slot = slots.current.get(selectedRef.current);
    if (!container || !slot || !viewportHeight) return;
    container.scrollTop += slot.getBoundingClientRect().top - container.getBoundingClientRect().top;
  }, [viewportHeight, postIds.length, scrollRef]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const topOf = (index: number) => {
      const slot = slots.current.get(index);
      return slot ? container.scrollTop + slot.getBoundingClientRect().top - container.getBoundingClientRect().top : container.scrollTop;
    };
    const land = (index: number) => {
      if (index === selectedRef.current) return;
      selectedRef.current = index;
      setSelected(index);
      logDebug("block_open", index + 1, postIds[index], { freshMount: true });
    };
    const settle = () => {
      let nearest = selectedRef.current;
      let distance = Infinity;
      slots.current.forEach((_, index) => {
        const delta = Math.abs(topOf(index) - container.scrollTop);
        if (delta < distance) { distance = delta; nearest = index; }
      });
      const target = programmaticTarget.current ?? nextBlockIndex(selectedRef.current, nearest - selectedRef.current, postIds.length);
      programmaticTarget.current = null;
      // A long fling still lands on the adjacent block, never skips ranks.
      container.scrollTo({ top: topOf(target), behavior: "instant" as ScrollBehavior });
      land(target);
    };
    const onScroll = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 160);
    };
    const move = (direction: number) => {
      if (Date.now() < busyUntil.current) return;
      const target = nextBlockIndex(selectedRef.current, direction, postIds.length);
      if (target === selectedRef.current) return;
      busyUntil.current = Date.now() + 650;
      programmaticTarget.current = target;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      container.scrollTo({ top: topOf(target), behavior: reducedMotion ? "instant" as ScrollBehavior : "smooth" });
      onScroll();
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      move(event.deltaY);
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input, textarea, [contenteditable=true]")) return;
      const direction = ["ArrowDown", "PageDown", " "].includes(event.key) ? 1 : ["ArrowUp", "PageUp"].includes(event.key) ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    let touchStart: { x: number; y: number } | undefined;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStart = touch ? { x: touch.clientX, y: touch.clientY } : undefined;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch || !touchStart) return;
      const dy = touchStart.y - touch.clientY;
      const dx = touchStart.x - touch.clientX;
      touchStart = undefined;
      if (Math.abs(dy) >= 55 && Math.abs(dy) > Math.abs(dx)) move(dy);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("keydown", onKey);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      if (settleTimer) clearTimeout(settleTimer);
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("keydown", onKey);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [postIds, scrollRef]);

  return postIds.map((id, index) => (
    <div
      key={id}
      ref={(node) => { if (node) slots.current.set(index, node); else slots.current.delete(index); }}
      className="snap-start snap-always px-4 py-4"
      style={{ minHeight: viewportHeight || "100%", overflowAnchor: "none" }}
    >
      {index === selected || !isVideo?.(index) ? (
        <div key={id} data-debug-rank={index + 1} data-debug-post-id={id}>
          {renderPost(index)}
        </div>
      ) : <PostSkeleton />}
    </div>
  ));
}