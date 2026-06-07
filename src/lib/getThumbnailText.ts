/**
 * Shared text extractor used by every post thumbnail surface
 * (profile grid, saved grid, shared post card, etc). Ensures all
 * thumbnails fall back to the post's own copy in a consistent way.
 */

function decode(text?: string | null): string {
  if (!text) return "";
  const doc = new DOMParser().parseFromString(text, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function isGenericTitle(title: string): boolean {
  if (!title) return true;
  if (title === "Reddit Post" || title === "Web Post") return true;
  // "@handle on Threads" / "Foo on Threads"
  if (/ on Threads$/i.test(title)) return true;
  // "X on Threads" / "X on X" / "Post on X"
  if (/^Post on (X|Twitter|Threads)$/i.test(title)) return true;
  return false;
}

function extractFromEmbedHtml(platform: string, embedHtml?: string | null): string {
  if (!embedHtml) return "";
  try {
    const doc = new DOMParser().parseFromString(embedHtml, "text/html");

    // X / Twitter / LinkedIn-style blockquote tweets carry the full
    // text inside the first <p> of the blockquote.
    if (platform === "x" || platform === "twitter") {
      const p = doc.querySelector("blockquote.twitter-tweet p, blockquote p");
      const t = decode(p?.innerHTML);
      if (t) return t;
    }

    // Threads: SDK rehydrates, but the raw embed sometimes contains a
    // <p> with the post text inside the blockquote shell.
    if (platform === "threads") {
      const p = doc.querySelector("blockquote p, blockquote a");
      const t = decode(p?.textContent);
      if (t && !/ on Threads$/i.test(t)) return t;
    }

    // Reddit: anchor pointing at /comments/ usually contains the title.
    if (platform === "reddit") {
      const a = doc.querySelector('a[href*="/comments/"]');
      const t = decode(a?.textContent);
      if (t) return t;
    }

    // Generic blockquote fallback
    const bq = doc.querySelector("blockquote");
    const fallback = decode(bq?.textContent);
    if (fallback) return fallback;
  } catch {
    // ignore
  }
  return "";
}

export interface ThumbnailTextSource {
  platform?: string | null;
  title?: string | null;
  content?: string | null;
  embed_html?: string | null;
  preview_title?: string | null;
  preview_text?: string | null;
}

export function getThumbnailText(post: ThumbnailTextSource): string {
  const platform = (post.platform || "").toLowerCase();
  const title = decode(post.title);
  const content = decode(post.content);
  const previewTitle = decode(post.preview_title);
  const previewText = decode(post.preview_text);

  if (!isGenericTitle(title)) return title;
  if (content) return content;
  if (previewTitle && !isGenericTitle(previewTitle)) return previewTitle;
  if (previewText) return previewText;

  const fromEmbed = extractFromEmbedHtml(platform, post.embed_html);
  if (fromEmbed) return fromEmbed;

  return "";
}