import { describe, test, expect } from 'bun:test';
import { isValidUsername, USERNAME_RULE_HINT } from './usernameRules';

describe('username rules', () => {
  test('rejects all-digit usernames like 2738192', () => {
    expect(isValidUsername('2738192')).toBe(false);
  });

  test('rejects punctuation-only names like _____ or $$$$$', () => {
    expect(isValidUsername('_____')).toBe(false);
    expect(isValidUsername('$$$$$')).toBe(false);
  });

  test('rejects names that do not start with a letter', () => {
    expect(isValidUsername('_nilesh')).toBe(false);
    expect(isValidUsername('.nilesh')).toBe(false);
    expect(isValidUsername('1nilesh')).toBe(false);
  });

  test('rejects symbols outside letters, numbers, dots and underscores', () => {
    expect(isValidUsername('nilesh$')).toBe(false);
    expect(isValidUsername('nilesh maurya')).toBe(false);
  });

  test('rejects names ending with a dot', () => {
    expect(isValidUsername('nilesh.')).toBe(false);
  });

  test('rejects names shorter than 3 or longer than 30 characters', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
  });

  test('accepts normal names like nilesh.maurya_01', () => {
    expect(isValidUsername('nilesh.maurya_01')).toBe(true);
    expect(isValidUsername('Nilesh')).toBe(true);
  });

  test('the rule hint mentions the letter-first requirement', () => {
    expect(USERNAME_RULE_HINT).toContain('starting with a letter');
  });
});
