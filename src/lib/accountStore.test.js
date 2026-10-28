import { describe, test, expect } from 'bun:test';
import {
  MAX_ACCOUNTS,
  canAddAccount,
  needsRefresh,
  pickNextAccount,
  removeAccount,
  upsertAccount,
} from './accountStore';

const acc = (id, lastUsedAt = 0) => ({
  userId: id,
  accessToken: `a-${id}`,
  refreshToken: `r-${id}`,
  expiresAt: 1000,
  lastUsedAt,
});

describe('saved accounts', () => {
  test('a device keeps at most 5 accounts', () => {
    expect(MAX_ACCOUNTS).toBe(5);
    let list = [];
    for (let i = 1; i <= 5; i++) list = upsertAccount(list, acc(`u${i}`, i));
    expect(list.length).toBe(5);
    expect(canAddAccount(list)).toBe(false);
  });

  test('a 6th sign-in drops the least recently used other account, never the new one', () => {
    let list = [];
    for (let i = 1; i <= 5; i++) list = upsertAccount(list, acc(`u${i}`, i));
    list = upsertAccount(list, acc('u6', 0));
    expect(list.map((a) => a.userId)).toEqual(['u2', 'u3', 'u4', 'u5', 'u6']);
  });

  test('refreshing tokens keeps the saved name and photo', () => {
    let list = upsertAccount([], { ...acc('u1'), username: 'bpp', avatarUrl: 'x.png' });
    list = upsertAccount(list, { userId: 'u1', accessToken: 'new', refreshToken: 'new-r', expiresAt: 2000 });
    expect(list[0].username).toBe('bpp');
    expect(list[0].avatarUrl).toBe('x.png');
    expect(list[0].refreshToken).toBe('new-r');
  });

  test('logging out opens the most recently used other account', () => {
    const list = [acc('a', 10), acc('b', 30), acc('c', 20)];
    expect(pickNextAccount(list, 'b').userId).toBe('c');
    expect(pickNextAccount(removeAccount(list, 'b'), 'b').userId).toBe('c');
    expect(pickNextAccount([acc('a', 1)], 'a')).toBe(null);
  });

  test('a token expiring within a minute is refreshed before switching', () => {
    expect(needsRefresh(acc('a'), 950)).toBe(true);
    expect(needsRefresh(acc('a'), 900)).toBe(false);
  });
});
