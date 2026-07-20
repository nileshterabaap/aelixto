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

---

# Platform Guard (Per-Platform Freeze — token-gated)

A stronger, per-platform lock that the agent **cannot bypass in a single turn**.

## How it differs from Stability Guard
- Stability Guard tracks a shared baseline that any process (including the agent) can `approve` and overwrite. It catches accidental drift but not intentional edits by the agent.
- Platform Guard freezes a platform's files with a **user-owned token**. The agent can `guard` (freeze current state) but cannot `unfreeze` or re-guard without `STABILITY_TOKEN`. `npm run build` runs `platform:check` first and fails if any frozen platform drifted.

## One-time setup (do this now)
Pick a secret and seal it — this token is what protects every future freeze:
```bash
STABILITY_TOKEN='pick-a-long-secret' npm run platform:seal
```
Store the token somewhere safe (password manager). Do **not** paste it in chat.

## Currently frozen platforms
- `x` → `src/hooks/useOriginalVisitTracker.ts`, `src/components/embeds/TwitterEmbed.tsx`
- `threads` → `src/hooks/useOriginalVisitTracker.ts`

## Commands
| Command | Needs token? | Purpose |
| --- | --- | --- |
| `npm run platform:status` | no | List platforms and drift |
| `npm run platform:check` | no | Fail if any frozen platform drifted (runs on build) |
| `npm run platform:guard <name>` | only if already frozen | Snapshot current files as the frozen baseline |
| `npm run platform:restore <name>` | no | Revert files to the frozen baseline |
| `npm run platform:unfreeze <name>` | **yes** | Unlock so the baseline can be re-guarded |
| `npm run platform:seal` | first time only | Seal the master token |
| `npm run platform:rotate` | **yes** | Rotate to a new token (`STABILITY_TOKEN_NEW`) |

## Workflow for future platform work
1. Fix one platform (e.g. Instagram).
2. Verify it works.
3. `npm run platform:check` → confirms no guarded platform regressed.
4. Say "guard it" — I add Instagram to `.stability-platforms.json` and run `npm run platform:guard instagram`.
5. From then on, any change to those files fails the build until you unfreeze with your token.

## To intentionally update a guarded platform
```bash
STABILITY_TOKEN='...' npm run platform:unfreeze x
# ...make changes, test...
STABILITY_TOKEN='...' npm run platform:guard x
```
