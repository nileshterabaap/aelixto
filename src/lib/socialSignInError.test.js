import { describe, test, expect } from 'bun:test';
import { isCancellation } from './socialSignInError';

describe('social sign-in cancellation', () => {
  test('backing out of the Google sheet counts as cancelled', () => {
    expect(isCancellation('Google Sign-In cancelled by user')).toBe(true);
  });

  test('no usable Google account is a failure, not a silent cancel', () => {
    expect(isCancellation('Google Sign-In failed: No credentials available')).toBe(false);
  });

  test('a refused sign-in is a failure', () => {
    expect(isCancellation('Google Sign-In failed: [16] Account reauth failed.')).toBe(false);
  });
});

import { shouldRetryAndroidGoogle } from './socialSignInError';

describe('Android Google retry after a false cancel', () => {
  test('first cancel on Android Google retries once', () => {
    expect(shouldRetryAndroidGoogle({ platform: 'android', provider: 'google', cancelled: true, alreadyRetried: false })).toBe(true);
  });
  test('never retries a second time', () => {
    expect(shouldRetryAndroidGoogle({ platform: 'android', provider: 'google', cancelled: true, alreadyRetried: true })).toBe(false);
  });
  test('iPhone does not use this retry', () => {
    expect(shouldRetryAndroidGoogle({ platform: 'ios', provider: 'google', cancelled: true, alreadyRetried: false })).toBe(false);
  });
});
