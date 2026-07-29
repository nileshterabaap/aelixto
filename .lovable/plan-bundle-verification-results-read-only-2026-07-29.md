# Bundle Verification Results (read-only)

## Verdict: the app you are testing is NOT running the restored bundle.

## Evidence

### 1. Service worker / Workbox cache — ruled out
- No Workbox / `vite-plugin-pwa` service worker is generated. `vite.config.ts` contains only React + tagger plugins; the `vite-plugin-pwa` and `workbox-window` entries in `package.json` are unused leftovers.
- `src/main.tsx` actively unregisters every service worker except `/sw-push.js`.
- `public/sw-push.js` has no `caches` or `fetch` handlers — push only, so it cannot serve stale HTML or JS.
- Live HTML is served with `cache-control: no-cache, must-revalidate, max-age=0`.

Conclusion: browser / PWA caching is not the cause.

### 2. Vite build hash / served bundle
- `https://aelixto.com` serves `/assets/index-Cu4mG3-2.js`, deployment id `79d234ba-e2ce-4217-a590-f717812a468d`.

### 3. Served bundle vs restored source — MISMATCH
The Threads embed URL builder differs:

```text
Served bundle:    https://www.threads.net${pathname.replace(/\/$/,"")}/embed
Workspace source: https://www.threads.net/@${user}/post/${id}/embed    (canonicalized)
```

Two consequences:
- The published site has not been rebuilt/republished since the revert, so the live app is an older build.
- The workspace still contains the canonicalization change from the last fix you asked to undo — so the revert did not put that file at the checkpoint you intended either. Neither the live app nor the workspace matches your target state.

### 4. Capacitor / APK — the likely reason nothing changed for you
- `capacitor.config.ts` sets `webDir: 'dist'` with no `server.url`. The APK ships a bundle baked in at build time.
- Reverting in Lovable, and even republishing the web app, changes nothing inside an already-installed APK. Only a fresh build + `npx cap sync` + reinstall updates it.

### 5. Additional finding (recorded, not fixed)
Three separate places build the Threads embed src and they are not identical:
- `src/components/embeds/ThreadsEmbed.tsx:276` (canonicalized)
- `src/components/UniversalMetaEmbed.tsx:841` (raw pathname)
- `src/lib/measureEmbedHeight.ts:42` (raw pathname)

## Edge function verification — not performed
Per your instruction, edge functions are only checked once the bundle is confirmed correct. It is not, so this step was skipped. Nothing was modified.

## Proposed next steps (need your decision)
1. You name the exact checkpoint that is the source of truth for Threads.
2. I diff `ThreadsEmbed.tsx`, `UniversalMetaEmbed.tsx`, `measureEmbedHeight.ts`, `ThreadsAwareMetaEmbed.tsx` and `index.css` against it and report — still read-only.
3. Only after you confirm the diff: restore those files, publish, and for the APK rebuild + `npx cap sync` + reinstall.
4. Then compare each deployed edge function against the restored source.