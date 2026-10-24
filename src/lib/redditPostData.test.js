import { describe, expect, test } from "bun:test";
import { parseRedditPostJson, toRedditJsonUrl } from "./redditPostData";

const wrap = (post) => [{ data: { children: [{ data: post }] } }];

describe("iPhone Reddit card data", () => {
  test("video posts use Reddit's streaming address so sound plays", () => {
    const d = parseRedditPostJson(wrap({
      subreddit: "goatravel", author: "a", title: "Falls", permalink: "/r/goatravel/comments/x1/falls/",
      is_video: true,
      secure_media: { reddit_video: { hls_url: "https://v.redd.it/x/HLSPlaylist.m3u8?a=1&amp;b=2", fallback_url: "https://v.redd.it/x/DASH_720.mp4", width: 720, height: 1280 } },
    }));
    expect(d.media.type).toBe("video");
    expect(d.media.hlsUrl).toBe("https://v.redd.it/x/HLSPlaylist.m3u8?a=1&b=2");
    expect(d.permalink).toBe("https://www.reddit.com/r/goatravel/comments/x1/falls/");
  });

  test("gallery posts keep Reddit's image order", () => {
    const d = parseRedditPostJson(wrap({
      subreddit: "s", author: "a", title: "t", permalink: "/r/s/comments/g/t/", is_gallery: true,
      gallery_data: { items: [{ media_id: "b" }, { media_id: "a" }] },
      media_metadata: { a: { s: { u: "https://i.redd.it/a.jpg", x: 10, y: 10 } }, b: { s: { u: "https://i.redd.it/b.jpg", x: 10, y: 20 } } },
    }));
    expect(d.media.type).toBe("images");
    expect(d.media.images.map((i) => i.url)).toEqual(["https://i.redd.it/b.jpg", "https://i.redd.it/a.jpg"]);
  });

  test("text posts have no media and keep their body", () => {
    const d = parseRedditPostJson(wrap({ subreddit: "s", author: "a", title: "Hello", selftext: "Body", is_self: true, permalink: "/r/s/comments/t/h/" }));
    expect(d.media.type).toBe("none");
    expect(d.selftext).toBe("Body");
    expect(d.externalDomain).toBe(null);
  });

  test("only canonical comment addresses become JSON addresses", () => {
    expect(toRedditJsonUrl("https://www.reddit.com/r/s/comments/abc123/slug/?share_id=1")).toBe("https://www.reddit.com/comments/abc123/.json?raw_json=1&limit=1");
    expect(toRedditJsonUrl("https://www.reddit.com/r/s/s/3zNCVHyoJT")).toBe(null);
  });
});
