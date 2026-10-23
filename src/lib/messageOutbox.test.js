import { describe, test, expect } from 'bun:test';
import {
  SEND_ATTEMPTS,
  isAlreadySentError,
  isPermanentSendError,
  mergeWithPending,
  newMessageId,
} from './messageOutbox';

describe('outgoing chat messages', () => {
  test('a retry whose id is already saved counts as sent, never as a second copy', () => {
    expect(isAlreadySentError({ code: '23505' })).toBe(true);
    expect(isPermanentSendError({ code: '23505' })).toBe(false);
  });

  test('a dropped connection is retried, a blocked chat is not', () => {
    expect(isPermanentSendError({ code: '' })).toBe(false);
    expect(isPermanentSendError(null)).toBe(false);
    expect(isPermanentSendError({ code: '42501' })).toBe(true);
  });

  test('a message the server already has stops showing the clock', () => {
    const server = [{ id: 'a' }, { id: 'b' }];
    const pending = [{ id: 'b' }, { id: 'c' }];
    const { list, delivered } = mergeWithPending(server, pending);
    expect(list.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(delivered).toEqual(['b']);
  });

  test('a message is tried 4 times quietly before showing "Not sent"', () => {
    expect(SEND_ATTEMPTS).toBe(4);
  });

  test('every message gets its own id up front', () => {
    const a = newMessageId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newMessageId()).not.toBe(a);
  });
});
