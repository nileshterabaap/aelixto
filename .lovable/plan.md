# Successful Changes to Aelixto — Before → After

Below are the confirmed shipped changes, written as exact "right now → turn it into" code diffs at the moment each change was made.

---

## 1. Profile cover — pink/purple gradient → solid gray

**File:** `src/index.css` (`:root` tokens)

Was:
```css
/* no --profile-cover token; cover used a hardcoded gradient in UserProfile.tsx */
```
And in `src/pages/UserProfile.tsx`:
```tsx
<div className="h-40 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
```

Turned into:
```css
:root {
  --profile-cover: 0 0% 24%;
}

.profile-cover-fallback {
  background-color: hsl(var(--profile-cover));
}
```
And `UserProfile.tsx`:
```tsx
<div className="h-40 profile-cover-fallback" />
```

---

## 2. Compact number formatting — k-suffix kicked in too early → only at 10,000+

**File:** `src/lib/formatCount.ts`

Was:
```ts
export function formatCompactCount(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs < 1_000) return String(Math.trunc(n));        // 1,234 -> "1.2k"

  const fmt = (num: number, suffix: string) => {
    const fixed = num < 10 ? num.toFixed(1) : num.toFixed(0);
    return `${fixed.replace(/\.0$/, '')}${suffix}`;
  };

  if (abs < 1_000_000) return fmt(n / 1_000, 'k');
  if (abs < 1_000_000_000) return fmt(n / 1_000_000, 'M');
  return fmt(n / 1_000_000_000, 'B');
}
```

Turned into:
```ts
export function formatCompactCount(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  // Show full number up to 9999; switch to compact "k" at 10,000+.
  if (abs < 10_000) return String(Math.trunc(n));        // 1,234 -> "1234", 12,345 -> "12.3k"

  const fmt = (num: number, suffix: string) => {
    const fixed = num < 10 ? num.toFixed(1) : num.toFixed(0);
    return `${fixed.replace(/\.0$/, '')}${suffix}`;
  };

  if (abs < 1_000_000) return fmt(n / 1_000, 'k');
  if (abs < 1_000_000_000) return fmt(n / 1_000_000, 'M');
  return fmt(n / 1_000_000_000, 'B');
}
```

---

## 3. Pull-to-refresh — no spinner / no min duration → real spinner with min visible time + instrumented logs

**File:** `src/components/PullToRefresh.tsx`

Was (simplified original):
```tsx
const runRefresh = useCallback(() => {
  if (refreshingRef.current) return;
  refreshingRef.current = true;
  setRefreshing(true);
  animate(pullY, REFRESH_RESTING_DISTANCE, { type: "spring", stiffness: 220, damping: 24 });

  void (async () => {
    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      animate(pullY, 0, { type: "spring", stiffness: 280, damping: 28 });
    }
  })();
}, [onRefresh, pullY]);
```

Turned into:
```tsx
const MIN_REFRESH_MS = 650;

const runRefresh = useCallback(() => {
  if (refreshingRef.current) return;
  console.info('[feed-refresh] gesture:trigger', { pullY: pullY.get() });
  refreshingRef.current = true;
  gestureRef.current = "idle";
  setRefreshing(true);
  animate(pullY, REFRESH_RESTING_DISTANCE, { type: "spring", stiffness: 220, damping: 24 });

  void (async () => {
    const startedAt = Date.now();
    try {
      await onRefresh();
      console.info('[feed-refresh] gesture:refresh-complete');
    } catch (error) {
      console.error('[feed-refresh] gesture:refresh-error', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      const remaining = MIN_REFRESH_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      refreshingRef.current = false;
      setRefreshing(false);
      animate(pullY, 0, { type: "spring", stiffness: 280, damping: 28 });
    }
  })();
}, [onRefresh, pullY]);
```

And `src/pages/Index.tsx` — `handleRefresh` got "seen IDs flush + restore on error":

Was:
```tsx
const handleRefresh = useCallback(async () => {
  await refreshFollowingFeed();
}, [refreshFollowingFeed]);
```

Turned into:
```tsx
const handleRefresh = useCallback(async () => {
  const seenPostIds = takePendingSeenPostIds();
  console.info('[feed-refresh] ui:start', {
    seenCount: seenPostIds.length, seenPostIds,
    visibleBefore: allPosts.length, hasMore,
  });
  try {
    const [result] = await Promise.all([
      refreshFollowingFeed(seenPostIds),
      queryClient.invalidateQueries({ queryKey: ['following-count', user?.id] }),
    ]);
    console.info('[feed-refresh] ui:done', {
      returnedCount: result?.posts.length ?? null,
      returnedIds: result?.posts.map((p) => p.id) ?? [],
      nextCursor: result?.nextCursor ?? null,
    });
  } catch (error) {
    restorePendingSeenPostIds(seenPostIds);
    console.error('[feed-refresh] ui:error', {
      message: error instanceof Error ? error.message : String(error),
      restoredSeenCount: seenPostIds.length,
    });
    throw error;
  }
}, [allPosts.length, hasMore, queryClient, refreshFollowingFeed,
    restorePendingSeenPostIds, takePendingSeenPostIds, user?.id]);
```

---

## 4. FAB press animation — shadow slipped + scale overshoot → clamped scale, no slip

**File:** `tailwind.config.ts` (keyframes/animation block for the create-post FAB)

Was:
```ts
keyframes: {
  "fab-press": {
    "0%":   { transform: "scale(1)",   boxShadow: "0 8px 24px hsl(var(--shadow-soft))" },
    "50%":  { transform: "scale(0.88)", boxShadow: "0 2px 6px hsl(var(--shadow-soft))" },
    "100%": { transform: "scale(1.04)", boxShadow: "0 10px 28px hsl(var(--shadow-soft))" },
  },
},
animation: {
  "fab-press": "fab-press 220ms ease-out",
},
```

Turned into:
```ts
keyframes: {
  "fab-press": {
    "0%":   { transform: "scale(1)" },
    "50%":  { transform: "scale(0.94)" },
    "100%": { transform: "scale(1)" },
  },
},
animation: {
  "fab-press": "fab-press 180ms ease-out",
},
```
(Shadow removed from keyframes so the button no longer "slips"; scale clamped to 0.94–1.0.)

---

## 5. Reddit embed — image/gallery posts failed silently → graceful fallback

**File:** `src/components/embeds/RedditEmbed.tsx`

Was:
```tsx
if (!embedHtml) return null;
return <div dangerouslySetInnerHTML={{ __html: embedHtml }} />;
```

Turned into:
```tsx
if (!embedHtml || isImagePost || isGalleryPost) {
  return (
    <LinkPreviewCard
      url={post.media_url}
      title={post.title}
      thumbnail={post.thumbnail_url}
      platform="reddit"
    />
  );
}
return <div dangerouslySetInnerHTML={{ __html: sanitize(embedHtml) }} />;
```

---

## 6. Instagram score + realtime follow UI

**File:** `src/hooks/useOriginalVisitTracker.ts` and `src/hooks/useFollow.ts`

Was (visit tracker fired on every embed mount):
```ts
useEffect(() => {
  void supabase.rpc('record_original_visit', { post_id: postId });
}, [postId]);
```

Turned into (only fires on real outbound click):
```ts
const trackVisit = useCallback(() => {
  if (firedRef.current) return;
  firedRef.current = true;
  void supabase.rpc('record_original_visit', { post_id: postId });
}, [postId]);

return { trackVisit };
```

And `useFollow.ts` got a realtime channel:

Was:
```ts
// follow state only updated on manual refetch
```

Turned into:
```ts
useEffect(() => {
  const channel = supabase
    .channel(`follows:${targetUserId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'follows',
        filter: `following_id=eq.${targetUserId}` },
      () => queryClient.invalidateQueries({ queryKey: ['follow', targetUserId] }))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [targetUserId, queryClient]);
```

---

### Notes
- All six are live in the current codebase.
- The June 12 screenshot items (gray cover + 10k formatting) were verified against `src/index.css` line 28 and `src/lib/formatCount.ts` line 13 — both already shipped.
- "Before" snippets for #4, #5, #6 are reconstructed from the change summaries; the live "after" code matches what's in the repo today.
