import { test, expect } from "bun:test";
import { referralFromUrl, referralFromInstallReferrer, inviteStoreUrl, inviteUrl, isNewInviteAccount } from "./inviteReferral";

test("Play Store link preserves the inviter through installation independently of launch method", () => {
  const url = new URL(inviteStoreUrl("nilesh_maurya"));
  expect(url.searchParams.get("id")).toBe("com.aelixto.app10");
  expect(referralFromInstallReferrer(url.searchParams.get("referrer"))).toBe("nilesh_maurya");
});
test("iPhone copied invitation preserves the same inviter", () => {
  expect(referralFromUrl(inviteUrl("nilesh_maurya"))).toBe("nilesh_maurya");
});
test("installed Android and iPhone accept the invitation scheme", () => {
  expect(referralFromUrl("aelixto://invite?ref=nilesh_maurya")).toBe("nilesh_maurya");
});
test("clipboard handoff rejects other websites and invalid names", () => {
  expect(referralFromUrl("https://example.com/get?ref=nilesh_maurya")).toBeNull();
  expect(referralFromUrl("https://aelixto.com/get?ref=bad%25name")).toBeNull();
});
test("existing 48-hour signup rule does not follow from older accounts", () => {
  const now = Date.parse("2026-11-11T09:08:00Z");
  expect(isNewInviteAccount("2026-11-09T09:08:00Z", now)).toBe(true);
  expect(isNewInviteAccount("2026-11-09T09:07:59Z", now)).toBe(false);
});