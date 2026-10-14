export function usesBlockNavigation(platform: string): boolean {
  return ["x", "twitter", "threads"].includes(platform.toLowerCase());
}

/** Momentum must not turn a single gesture into several post changes. */
export function nextBlockIndex(current: number, direction: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, current + Math.sign(direction)));
}