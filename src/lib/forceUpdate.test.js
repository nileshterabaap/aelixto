import { describe, test, expect } from 'bun:test';
import { mustForceUpdate } from './forceUpdate';

describe('forced update switch', () => {
  test('switch off never blocks, even on an old build', () => {
    expect(mustForceUpdate({ enabled: false, min_build: 50 }, '10')).toBe(false);
  });
  test('switch on blocks builds below the minimum', () => {
    expect(mustForceUpdate({ enabled: true, min_build: 50 }, '49')).toBe(true);
  });
  test('switch on lets the minimum build and newer through', () => {
    expect(mustForceUpdate({ enabled: true, min_build: 50 }, '50')).toBe(false);
    expect(mustForceUpdate({ enabled: true, min_build: 50 }, 51)).toBe(false);
  });
  test('switch on without a minimum build blocks nobody', () => {
    expect(mustForceUpdate({ enabled: true, min_build: null }, '1')).toBe(false);
  });
  test('unknown build or missing setting blocks nobody', () => {
    expect(mustForceUpdate({ enabled: true, min_build: 50 }, 'abc')).toBe(false);
    expect(mustForceUpdate(null, '1')).toBe(false);
  });
});
