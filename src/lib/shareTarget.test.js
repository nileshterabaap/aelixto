import { describe, test, expect } from 'bun:test';
import {
  SHARED_LINK_TTL_MS,
  consumePendingSharedLink,
  hasPendingSharedLink,
  setPendingSharedLink,
} from './shareTarget';

describe('shared link hand-off', () => {
  test('a shared link is handed to the composer exactly once', () => {
    setPendingSharedLink('https://x.com/a/status/1', 1000);
    expect(consumePendingSharedLink(2000)).toBe('https://x.com/a/status/1');
    expect(consumePendingSharedLink(2001)).toBeNull();
  });

  test('a shared link still waits just under 10 minutes later', () => {
    setPendingSharedLink('https://youtu.be/abc', 0);
    expect(hasPendingSharedLink(SHARED_LINK_TTL_MS - 1)).toBe(true);
    consumePendingSharedLink(0);
  });

  test('a shared link expires after 10 minutes and is never shown', () => {
    setPendingSharedLink('https://youtu.be/abc', 0);
    expect(hasPendingSharedLink(10 * 60 * 1000 + 1)).toBe(false);
    expect(consumePendingSharedLink(10 * 60 * 1000 + 2)).toBeNull();
  });
});
