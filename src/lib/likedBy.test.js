import { describe, test, expect } from 'bun:test';
import { selectLikedBy } from './likedBy';

const likes = [{ user_id: 'new' }, { user_id: 'friend' }];
const profiles = [{ user_id: 'new', username: 'newest' }, { user_id: 'friend', username: 'abc' }];
describe('liked-by selection', () => {
  test('prioritizes a followed person over a newer liker', () => {
    expect(selectLikedBy(likes, profiles, ['friend'], 124)?.person.username).toBe('abc');
  });
  test('excludes the named person from 124 total likes', () => {
    expect(selectLikedBy(likes, profiles, ['friend'], 124)?.others).toBe(123);
  });
  test('falls back to the newest visible liker', () => {
    expect(selectLikedBy(likes, profiles, [], 2)?.person.username).toBe('newest');
  });
  test('does not name an inaccessible profile', () => {
    expect(selectLikedBy(likes, profiles.slice(0, 1), ['friend'], 2)?.person.username).toBe('newest');
  });
  test('hides the summary when likes are hidden', () => {
    expect(selectLikedBy(likes, profiles, ['friend'], 124, true)).toBeNull();
  });
  test('hides the summary for no likes', () => {
    expect(selectLikedBy([], [], [], 0)).toBeNull();
  });
  test('a single like has no others', () => {
    expect(selectLikedBy(likes.slice(0, 1), profiles, [], 1)?.others).toBe(0);
  });
});