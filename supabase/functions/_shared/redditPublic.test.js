import { describe, expect, it } from "bun:test";
import {
  cleanRedditPostUrl,
  cleanRedditTitle,
  isGenericRedditText,
  parseRedditEmbedHtml,
} from "./redditPublic.ts";

const wrap = (inner) => `<html><body><div id="embed-container">${inner}</div></body></html>`;

describe("Reddit public helpers", () => {
  it("drops Reddit's double-encoded slug and share params", () => {
    expect(
      cleanRedditPostUrl("https://www.reddit.com/r/Pak/comments/1vawmne/my_fianc%25C3%25A9es/?share_id=x&amp;utm=1"),
    ).toBe("https://www.reddit.com/r/Pak/comments/1vawmne/");
  });

  it("treats crawler filler text as not real post text", () => {
    expect(isGenericRedditText("Explore this post and more from the shayri community")).toBe(true);
    expect(isGenericRedditText("24 votes, 20 comments. 101K subscribers in the Pak community. A sub")).toBe(true);
    expect(isGenericRedditText("Reddit · r/NatureIsFuckingLit")).toBe(true);
    expect(isGenericRedditText("A man in Goa offered his raincoat")).toBe(false);
  });

  it("strips the crawler prefix from titles", () => {
    expect(cleanRedditTitle("From the interesting community on Reddit: Bee on clothes")).toBe("Bee on clothes");
  });

  it("prefers the embed title over body headings", () => {
    const html = wrap(
      `<a>sub</a><span>Join</span><span>Posted by</span><a>me</a><span>·</span>` +
        `<shreddit-embed-title>Real title</shreddit-embed-title><h1>Body heading</h1><p>Body text</p><span>Read more</span>`,
    );
    const d = parseRedditEmbedHtml(html, "u");
    expect(d.title).toBe("Real title");
    expect(d.author).toBe("me");
    expect(d.subreddit).toBe("sub");
  });

  it("reads the video poster as the thumbnail", () => {
    const html = wrap(`<h1>Bee</h1><shreddit-player poster="https://external-preview.redd.it/a.png?width=640&amp;s=abc"></shreddit-player>`);
    expect(parseRedditEmbedHtml(html, "u").thumbnail).toBe("https://external-preview.redd.it/a.png?width=640&s=abc");
  });

  it("flags deleted posts", () => {
    expect(parseRedditEmbedHtml(wrap("This post has been deleted, but comments are still viewable."), "u").deleted).toBe(true);
  });
});
