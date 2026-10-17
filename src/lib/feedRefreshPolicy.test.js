import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { followingFeedQueryPolicy, shouldRecoverQuery, canStartFeedPull, feedPullDistance } from './feedRefreshPolicy';

describe('Home refresh rules', () => {
  test('background invalidation preserves posts until an explicit refresh', async () => {
    const client = new QueryClient();
    let calls = 0;
    const options = { queryKey: ['following-feed'], queryFn: async () => ++calls, ...followingFeedQueryPolicy };
    await client.fetchQuery(options);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    await client.invalidateQueries({ queryKey: ['following-feed'], refetchType: 'none' });
    expect(calls).toBe(1);
    expect(client.getQueryData(['following-feed'])).toBe(1);
    await client.refetchQueries({ queryKey: ['following-feed'], type: 'active' });
    expect(calls).toBe(2);
    unsubscribe();
    client.clear();
  });
  test('focus and reconnect cannot refresh Home', () => {
    expect(followingFeedQueryPolicy.refetchOnWindowFocus).toBe(false);
    expect(followingFeedQueryPolicy.refetchOnReconnect).toBe(false);
    expect(shouldRecoverQuery('following-feed', true, false)).toBe(false);
  });
  test('returning from background refreshes Home even when it is not stale', () => {
    expect(shouldRecoverQuery('following-feed', false, true)).toBe(true);
    expect(shouldRecoverQuery('notifications', true, false)).toBe(true);
  });
  test('returning from another app page does not refetch the mounted Home snapshot', () => {
    expect(followingFeedQueryPolicy.refetchOnMount).toBe(false);
  });
  test('scrolling upwards from below the top cannot arm a pull', () => {
    expect(canStartFeedPull(false, true, false, 1)).toBe(false);
    expect(canStartFeedPull(true, true, false, 1)).toBe(true);
  });
  test('hidden Home, navigation touches and multi-touch cannot arm a pull', () => {
    expect(canStartFeedPull(true, false, false, 1)).toBe(false);
    expect(canStartFeedPull(true, true, true, 1)).toBe(false);
    expect(canStartFeedPull(true, true, false, 2)).toBe(false);
  });
  test('only a deliberate vertical top pull reaches the 55px threshold', () => {
    expect(feedPullDistance(0, 180, true)).toBeGreaterThanOrEqual(55);
    expect(feedPullDistance(0, 50, true)).toBeLessThan(55);
    expect(feedPullDistance(200, 180, true)).toBe(0);
    expect(feedPullDistance(0, 180, false)).toBe(0);
    expect(feedPullDistance(0, -180, true)).toBe(0);
  });
});