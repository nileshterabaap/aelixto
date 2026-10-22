import { describe, test, expect } from 'bun:test';
import {
  SHARED_LINK_TTL_MS,
  acceptNativeSharedLink,
  consumePendingSharedLink,
  hasPendingSharedLink,
  resetNativeSharedLinkMemory,
  setPendingSharedLink,
} from './shareTarget';

describe('native share bridge', () => {
  test('Android returning to the app with the same old share does not deliver it again', () => {
    resetNativeSharedLinkMemory();
    expect(acceptNativeSharedLink('https://x.com/a/status/1', 'android', 0)).toBe(true);
    consumePendingSharedLink(1);
    expect(acceptNativeSharedLink('https://x.com/a/status/1', 'android', 2)).toBe(false);
    expect(hasPendingSharedLink(3)).toBe(false);
  });

  test('Android delivers a different shared link', () => {
    resetNativeSharedLinkMemory();
    acceptNativeSharedLink('https://x.com/a/status/1', 'android', 0);
    expect(acceptNativeSharedLink('https://youtu.be/abc', 'android', 1)).toBe(true);
    expect(consumePendingSharedLink(2)).toBe('https://youtu.be/abc');
  });

  test('iPhone delivers the same link shared twice', () => {
    resetNativeSharedLinkMemory();
    acceptNativeSharedLink('https://youtu.be/abc', 'ios', 0);
    consumePendingSharedLink(1);
    expect(acceptNativeSharedLink('https://youtu.be/abc', 'ios', 2)).toBe(true);
    consumePendingSharedLink(3);
  });
});


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
