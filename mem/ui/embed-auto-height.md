---
name: Embed Auto-Height Persistence
description: Threads/Facebook/Reddit iframe embeds measure rendered height via postMessage and persist to posts.suggested_height via RPC so future loads snap to exact size
type: feature
---
Threads, Facebook, and Reddit iframe embeds listen for the platform's postMessage resize events. When a real height arrives, `usePersistEmbedHeight(postId)` debounces a write to the `update_post_dimensions` RPC (security definer, authed users only, only writes if >5% delta or empty). On next load, `useFollowingFeed` passes `suggested_height` → `HydratedEmbed` → `UniversalMetaEmbed` → `ThreadsIframeEmbed/FacebookIframeEmbed/RedditEmbed`, which seed the iframe at the cached pixel height — eliminating blank space below short embeds. Instagram still uses fixed 3/5 aspect (Instagram iframes don't reliably postMessage). Defaults lowered: Threads 380px, Facebook 420px.