---
name: Embed Auto-Height Persistence
description: Threads/Facebook embeds measure rendered height at CREATE-time (hidden offscreen iframe in CreatePostDialog) and again at view-time, persisted to posts.suggested_height so the very first viewer (including the creator) opens the card at its real size
type: feature
---
Two-stage measurement:
1. CREATE TIME — `measureEmbedHeight(url)` in `src/lib/measureEmbedHeight.ts` mounts a hidden 500px-wide iframe in `CreatePostDialog.handleLinkSubmit`, listens for the platform's postMessage resize (Threads + Facebook only), and the measured height is saved on insert via `useCreatePost` → `posts.suggested_height`. The Post button waits up to 1.2s extra for the measurement before submitting.
2. VIEW TIME — Threads/Facebook/Reddit embeds also listen for postMessage at render and call `usePersistEmbedHeight(postId)` → `update_post_dimensions` RPC (security definer, >5% delta gate) as a self-healing fallback.

`useFollowingFeed` passes `suggested_height` → `HydratedEmbed` → `UniversalMetaEmbed` → `ThreadsIframeEmbed`/`FacebookIframeEmbed`/`RedditEmbed`, which seed the iframe at the cached pixel height. Instagram still uses fixed 3/5 aspect (no reliable postMessage). Defaults: Threads 380px, Facebook 420px.