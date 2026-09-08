# Stability Guard (Regression Lock)

This project now includes a **stability guard** to prevent accidental side effects in protected files.

## Protected files
Configured in `.stability-lock.json`:
- `src/components/HydratedFeedPost.tsx`
- `src/components/RawEmbedRenderer.tsx`
- `src/lib/resolveRenderer.ts`
- `src/index.css`

## How it works
- `npm run dev` now auto-runs restore first.
- `npm run build` now blocks if protected files changed unexpectedly.
- Baseline snapshots are stored in `.stability-lock.json`.

## Commands
- `npm run stability:status` → show drift status.
- `npm run stability:check` → fail if protected files drifted.
- `npm run stability:restore` → auto-restore protected files to approved baseline.
- `npm run stability:approve` → update baseline after intentional edits.

## Safe workflow
1. Make intentional changes.
2. Verify everything works.
3. Run `npm run stability:approve` to store the new trusted baseline.

If unintended edits happen later, `npm run stability:restore` will recover the protected files automatically.
