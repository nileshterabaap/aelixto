import { describe, test, expect } from "bun:test";
import { instagramResponseVerdict, clearRestoredSourceAlerts } from "./sourceAvailability.ts";

describe("Instagram source evidence", () => {
  test("login redirects are not deletion", () => expect(instagramResponseVerdict(200, "https://www.instagram.com/accounts/login/", "login")).toBe("unknown"));
  test("permission and bot errors are not deletion", () => {
    for (const status of [400, 403, 404, 410, 429, 500]) expect(instagramResponseVerdict(status, "", '{"error":"unsupported object"}', true)).toBe("unknown");
  });
  test("unavailable embed is inconclusive", () => expect(instagramResponseVerdict(200, "", "Sorry, this content isn't available right now")).toBe("unknown"));
  test("generic 200 shell is not restoration", () => expect(instagramResponseVerdict(200, "", '<title>Instagram</title>')).toBe("unknown"));
  test("actual post media confirms restoration", () => expect(instagramResponseVerdict(200, "", '{"shortcode":"ABC123","video_url":"https://cdn.example/video"}')).toBe("ok"));
  test("official post embed confirms restoration", () => expect(instagramResponseVerdict(200, "", JSON.stringify({html:'<blockquote><a href="https://www.instagram.com/p/ABC123/">Post</a></blockquote>'}), true)).toBe("ok"));
});

describe("restored-source cleanup", () => {
  test("only confirmed available sources clear their own deletion notice", async () => {
    const filters = [];
    const query = { eq: (key, value) => { filters.push([key, value]); return query; }, select: async () => ({data: [{id:"notice"}], error:null}) };
    const db = {from: table => {expect(table).toBe("notifications"); return {delete: () => query};}};
    expect(await clearRestoredSourceAlerts(db, {id:"post",user_id:"owner"}, "ok")).toBe(1);
    expect(filters).toEqual([["recipient_id","owner"],["post_id","post"],["type","report_outcome"],["metadata->>kind","source_removed"]]);
  });
  for (const verdict of ["unknown", "removed"]) test(`${verdict} does not remove notices`, async () => {
    expect(await clearRestoredSourceAlerts({from: () => {throw new Error("Must not delete");}}, {id:"post",user_id:"owner"}, verdict)).toBe(0);
  });
});