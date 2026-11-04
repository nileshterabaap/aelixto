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
  test('One Tap sheet errors are failures, not silent cancels', () => {
    expect(
      isCancellation('Google sign-in failed: During begin sign in, failure response from one tap: 10: [28444] Developer console is not set'),
    ).toBe(false);
  });
});
