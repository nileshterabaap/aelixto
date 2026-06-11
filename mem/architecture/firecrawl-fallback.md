---
name: Firecrawl fallback for blocked sites
description: Final scraper fallback in fetch-og and unfurl-article for Cloudflare/anti-bot walled domains (Britannica, Investing.com, etc.)
type: feature
---
After UA chain (Slackbot/FB/Googlebot/Chrome) and r.jina.ai proxy fail,
both `fetch-og` and `unfurl-article` call Firecrawl v2 `/scrape` with
`formats:['html']` using `FIRECRAWL_API_KEY` (linked connector secret).

- `fetch-og` returns Firecrawl metadata (ogTitle/ogImage/ogDescription) directly — bypasses local extractors which dropped synthetic image URLs.
- `unfurl-article` synthesizes a head with og:* meta + `<base href>` from Firecrawl, then runs through the normal extractor.

Order of fallbacks is preserved to keep credit usage minimal — Firecrawl is only hit when all free methods fail.