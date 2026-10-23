import { describe, expect, test } from "bun:test";
import { EMBED_RELAY_URL, toYouTubeRelaySrc } from "./iosEmbedRelay";

describe("iPhone YouTube relay", () => {
  test("YouTube players are routed through the website relay", () => {
    const src = "https://www.youtube.com/embed/abc123?autoplay=0&enablejsapi=1&origin=capacitor%3A%2F%2Flocalhost";
    expect(toYouTubeRelaySrc(src)).toBe(`${EMBED_RELAY_URL}?src=${encodeURIComponent(src)}`);
  });

  test("relay address still contains youtube.com so pausing keeps matching it", () => {
    expect(toYouTubeRelaySrc("https://www.youtube-nocookie.com/embed/xyz")).toContain("youtube-nocookie.com");
    expect(toYouTubeRelaySrc("https://www.youtube.com/embed/xyz")).toContain("youtube.com");
  });

  test("non-player and non-YouTube frames are left alone", () => {
    expect(toYouTubeRelaySrc("https://www.youtube.com/watch?v=xyz")).toBeNull();
    expect(toYouTubeRelaySrc("https://open.spotify.com/embed/track/1")).toBeNull();
    expect(toYouTubeRelaySrc(`${EMBED_RELAY_URL}?src=https%3A%2F%2Fwww.youtube.com%2Fembed%2Fx`)).toBeNull();
    expect(toYouTubeRelaySrc("about:blank")).toBeNull();
    expect(toYouTubeRelaySrc(null)).toBeNull();
  });
});
