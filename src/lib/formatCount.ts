/**
 * Instagram-style compact number formatting.
 *  - <1,000        -> "923"
 *  - <1,000,000    -> "1.2k" / "12.3k" / "123k"
 *  - <1,000,000,000 -> "1.2M" / "12.3M" / "123M"
 *  - >=1B          -> "1.2B"
 */
export function formatCompactCount(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.trunc(n));

  const fmt = (num: number, suffix: string) => {
    // Show one decimal only when below 10 in the unit (e.g. 1.2k, but 12k).
    const fixed = num < 10 ? num.toFixed(1) : num.toFixed(0);
    // Trim trailing ".0"
    return `${fixed.replace(/\.0$/, '')}${suffix}`;
  };

  if (abs < 1_000_000) return fmt(n / 1_000, 'k');
  if (abs < 1_000_000_000) return fmt(n / 1_000_000, 'M');
  return fmt(n / 1_000_000_000, 'B');
}
