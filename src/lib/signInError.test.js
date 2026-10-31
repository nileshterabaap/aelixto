import { describe, test, expect } from 'bun:test';
import { signInFailureMessage, usernameNotFoundMessage } from './signInError';

describe('sign-in failure message', () => {
  test('unknown email says the account was not found, not the password', () => {
    const m = signInFailureMessage({ viaUsername: false, method: 'none' });
    expect(m.description).toBe('No account found with this email.');
  });

  test('existing password account says only the password is wrong', () => {
    const m = signInFailureMessage({ viaUsername: false, method: 'password' });
    expect(m.title).toBe('Incorrect password');
  });

  test('found username with failed check still means wrong password', () => {
    const m = signInFailureMessage({ viaUsername: true, method: null });
    expect(m.title).toBe('Incorrect password');
  });

  test('Google/Apple-only account points to those buttons', () => {
    const m = signInFailureMessage({ viaUsername: false, method: 'social' });
    expect(m.title).toBe('Use Google or Apple');
  });

  test('no message combines both reasons with "or"', () => {
    for (const method of ['none', 'password', 'social', null]) {
      for (const viaUsername of [true, false]) {
        const m = signInFailureMessage({ viaUsername, method });
        expect(m.description.toLowerCase()).not.toContain('password, or');
        expect(m.description.toLowerCase()).not.toContain('email/username');
      }
    }
  });

  test('unknown username names the username', () => {
    expect(usernameNotFoundMessage('abc').description).toBe('No account found with the username @abc.');
  });
});
