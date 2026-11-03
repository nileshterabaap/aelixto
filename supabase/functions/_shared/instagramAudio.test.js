import { describe, test, expect } from "bun:test";
import {
  parseInstagramAudioAttribution,
  instagramReelShortcode,
} from "./instagramAudio.ts";

const musicLibraryReel =
  'clips_music_attribution_info\\":{\\"artist_name\\":\\"Dua Lipa\\",\\"song_name\\":\\"Levitating\\",\\"uses_original_audio\\":false,\\"should_mute_audio\\":false},\\"owner\\":{}';

const originalAudioReel =
  'clips_music_attribution_info\\":{\\"artist_name\\":\\"ira_bhaktilife\\",\\"song_name\\":\\"Original audio\\",\\"uses_original_audio\\":true,\\"should_mute_audio\\":false},\\"owner\\":{}';

describe("Instagram music-library audio detection", () => {
  test("licensed library audio is flagged", () => {
    const r = parseInstagramAudioAttribution(`<html>${musicLibraryReel}</html>`);
    expect(r.musicLibraryAudio).toBe(true);
    expect(r.songName).toBe("Levitating");
    expect(r.artistName).toBe("Dua Lipa");
  });

  test("creator's original audio is not flagged", () => {
    const r = parseInstagramAudioAttribution(`<html>${originalAudioReel}</html>`);
    expect(r.musicLibraryAudio).toBe(false);
  });

  test("attribution block with no song name is inconclusive", () => {
    const r = parseInstagramAudioAttribution(
      '<html>clips_music_attribution_info\\":{\\"uses_original_audio\\":false}</html>'
    );
    expect(r.musicLibraryAudio).toBeNull();
  });

  test("embed page without attribution data is inconclusive", () => {
    expect(parseInstagramAudioAttribution("<html>no data</html>").musicLibraryAudio).toBeNull();
    expect(parseInstagramAudioAttribution("").musicLibraryAudio).toBeNull();
  });

  test("unescaped JSON values are decoded", () => {
    const html = 'song_name\\":\\"Caf\\u00e9 Rendez\\-vous\\",\\"uses_original_audio\\":false';
    const r = parseInstagramAudioAttribution(html);
    expect(r.musicLibraryAudio).toBe(true);
    expect(r.songName).toBe("Caf\u00e9 Rendez-vous");
  });
});

describe("reel shortcode extraction", () => {
  test("accepts reel URLs", () => {
    expect(instagramReelShortcode("https://www.instagram.com/reel/DeWR8JqOlif/?obrf=x")).toBe("DeWR8JqOlif");
    expect(instagramReelShortcode("https://instagram.com/reels/C0nBQrrK3gx/")).toBe("C0nBQrrK3gx");
  });

  test("rejects non-reel Instagram URLs and other hosts", () => {
    expect(instagramReelShortcode("https://www.instagram.com/p/C0nBQrrK3gx/")).toBeNull();
    expect(instagramReelShortcode("https://example.com/reel/ABC123")).toBeNull();
    expect(instagramReelShortcode("")).toBeNull();
  });
});
