import { describe, test, expect } from 'bun:test';
import { MAX_PINNED_CHATS, canPinAnotherChat, sortChats } from './chatListOrder';

const chat = (id, lastAt, pinnedAt = null) => ({
  id,
  pinned_at: pinnedAt,
  updated_at: lastAt,
  last_message: { created_at: lastAt },
});

describe('chat list order', () => {
  test('pinned chats stay above newer unpinned chats', () => {
    const list = sortChats([
      chat('new', '2026-10-28T10:00:00Z'),
      chat('pinned', '2026-01-01T00:00:00Z', '2026-10-01T00:00:00Z'),
    ]);
    expect(list.map((c) => c.id)).toEqual(['pinned', 'new']);
  });

  test('the most recently pinned chat comes first', () => {
    const list = sortChats([
      chat('a', '2026-10-28T10:00:00Z', '2026-10-01T00:00:00Z'),
      chat('b', '2026-01-01T00:00:00Z', '2026-10-05T00:00:00Z'),
    ]);
    expect(list.map((c) => c.id)).toEqual(['b', 'a']);
  });

  test('unpinned chats are ordered by latest message', () => {
    const list = sortChats([
      chat('old', '2026-10-01T00:00:00Z'),
      chat('new', '2026-10-28T00:00:00Z'),
    ]);
    expect(list.map((c) => c.id)).toEqual(['new', 'old']);
  });

  test('at most 3 chats can be pinned', () => {
    expect(MAX_PINNED_CHATS).toBe(3);
    const two = [chat('a', 'x', '2026-10-01'), chat('b', 'x', '2026-10-02'), chat('c', 'x')];
    expect(canPinAnotherChat(two)).toBe(true);
    const three = [...two.slice(0, 2), chat('c', 'x', '2026-10-03')];
    expect(canPinAnotherChat(three)).toBe(false);
  });
});
