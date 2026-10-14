import { describe, expect, test } from "bun:test";
import { nextBlockIndex, usesBlockNavigation } from "./blockNavigation";

describe("profile block navigation", () => {
  test("only X and Threads use blocks", () => {
    expect(["x", "twitter", "threads"].map(usesBlockNavigation)).toEqual([true, true, true]);
    expect(["instagram", "facebook", "youtube", "tiktok", "reddit", "pinterest", "spotify", "linkedin", "quora", "article", "external"].map(usesBlockNavigation)).toEqual(Array(11).fill(false));
  });
  test("one forward gesture advances exactly one rank", () => {
    expect(nextBlockIndex(3, 700, 10)).toBe(4);
  });
  test("one backward gesture advances exactly one rank", () => {
    expect(nextBlockIndex(3, -700, 10)).toBe(2);
  });
  test("first and last ranks never wrap", () => {
    expect(nextBlockIndex(0, -1, 10)).toBe(0);
    expect(nextBlockIndex(9, 1, 10)).toBe(9);
  });
});