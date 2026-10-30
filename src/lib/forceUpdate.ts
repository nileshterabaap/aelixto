/**
 * Forced update rule (pure, testable).
 * The app is blocked only when the switch for this phone type is ON,
 * a minimum build number is set, and this install's build is below it.
 */
export type ForceUpdateFlag = { enabled: boolean; min_build: number | null } | null;

export function mustForceUpdate(flag: ForceUpdateFlag, currentBuild: string | number | null | undefined): boolean {
  if (!flag || !flag.enabled) return false;
  if (flag.min_build == null || !Number.isFinite(flag.min_build)) return false;
  const build = typeof currentBuild === 'number' ? currentBuild : parseInt(String(currentBuild ?? ''), 10);
  if (!Number.isFinite(build)) return false; // unknown build: never lock people out
  return build < flag.min_build;
}

export const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.aelixto.app10';
export const IOS_STORE_URL = 'https://apps.apple.com/app/id6824479481';
