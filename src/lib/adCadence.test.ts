import { describe, expect, test } from 'bun:test';
import { computeAdAfterIndices } from './adCadence';

describe('ad cadence', () => {
  test('fresh viewer sees the first ad after 7 posts', () => {
    expect(computeAdAfterIndices(20, 0, 7)).toEqual([6, 13]);
  });
  test('carried seen posts shorten the wait for the first ad', () => {
    expect(computeAdAfterIndices(20, 4, 7)).toEqual([2, 9, 16]);
  });
  test('an ad already due goes in the second spot, never first', () => {
    expect(computeAdAfterIndices(20, 7, 7)[0]).toBe(0);
    expect(computeAdAfterIndices(20, 12, 7)[0]).toBe(0);
  });
  test('no ad after the last post', () => {
    expect(computeAdAfterIndices(3, 0, 7)).toEqual([]);
  });
});
