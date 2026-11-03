// Instagram reel audio detection.
//
// Instagram's public /reel/<code>/embed/ page exposes a
// `clips_music_attribution_info` block. When a reel uses audio from
// Instagram's own music library, that block names the licensed song
// (`uses_original_audio: false`). Reels with the creator's own audio report
// `uses_original_audio: true`. Reels using licensed music-library audio do not
// play (with sound) when embedded in other apps, so Aelixto warns creators at
// post-creation time.

export type InstagramAudioResult = {
  // true  = audio from Instagram's music library (won't play embedded)
  // false = creator's own audio (plays embedded)
  // null  = inconclusive (page unavailable or no attribution data)
  musicLibraryAudio: boolean | null;
  songName: string | null;
  artistName: string | null;
};

export const INCONCLUSIVE_AUDIO: InstagramAudioResult = {
  musicLibraryAudio: null,
  songName: null,
  artistName: null,
};

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(["\\\/bfnrt])/g, (_, ch) => {
      switch (ch) {
        case "b": return "\b";
        case "f": return "\f";
        case "n": return "\n";
        case "r": return "\r";
        case "t": return "\t";
        default: return ch;
      }
    });
}

/** Parse the music attribution data out of an Instagram embed page. */
export function parseInstagramAudioAttribution(html: string): InstagramAudioResult {
  if (!html) return INCONCLUSIVE_AUDIO;

  // The embed page inlines escaped JSON, so keys/values may carry `\"`.
  const attribution = html.match(/clips_music_attribution_info\\?"\s*:\s*(\{[^{}]*\})/);
  if (!attribution) return INCONCLUSIVE_AUDIO;
  const block = attribution[1];

  const usesOriginalAudio = /uses_original_audio\\?"\s*:\s*true/.test(block);
  // Values end at a quote that is not escaped (`\"` closes the field in the
  // escaped embed JSON; `"` closes it in plain JSON).
  const songMatch = block.match(/song_name\\?"\s*:\s*\\?"((?:(?!\\").)*?)\\?"/);
  const artistMatch = block.match(/artist_name\\?"\s*:\s*\\?"((?:(?!\\").)*?)\\?"/);
  const songName = songMatch ? unescapeJsonString(songMatch[1]) : null;
  const artistName = artistMatch ? unescapeJsonString(artistMatch[1]) : null;

  if (usesOriginalAudio) {
    return { musicLibraryAudio: false, songName, artistName };
  }

  // Licensed track: Instagram names the song (and it is never literally
  // "Original audio" for library music).
  if (songName && !/^original audio$/i.test(songName)) {
    return { musicLibraryAudio: true, songName, artistName };
  }

  return INCONCLUSIVE_AUDIO;
}

/** Extract the reel shortcode from an Instagram URL, if present. */
export function instagramReelShortcode(url: string): string | null {
  if (!url) return null;
  if (!/instagram\.com/i.test(url)) return null;
  const match = url.match(/instagram\.com\/reels?\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Fetch the reel's public embed page and classify its audio. Deno-only
 * (uses fetch + AbortSignal.timeout). Returns INCONCLUSIVE_AUDIO when
 * Instagram blocks or the page carries no attribution data.
 */
export async function checkInstagramReelAudio(url: string): Promise<InstagramAudioResult> {
  const shortcode = instagramReelShortcode(url);
  if (!shortcode) return INCONCLUSIVE_AUDIO;

  try {
    const response = await fetch(`https://www.instagram.com/reel/${shortcode}/embed/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AelixtoBot/1.0; +https://aelixto.com)" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return INCONCLUSIVE_AUDIO;
    const html = await response.text();
    return parseInstagramAudioAttribution(html);
  } catch {
    return INCONCLUSIVE_AUDIO;
  }
}
