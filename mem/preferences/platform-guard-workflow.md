---
name: Platform Guard Auto-Check Workflow
description: After every code edit, auto-run platform:check; on drift, auto-restore and stop
type: preference
---
After ANY code-editing task (not just before build):
1. Run `npm run platform:check`.
2. If any frozen platform drifted:
   - Run `npm run platform:restore <name>` for each drifted platform.
   - STOP the task immediately. Do not continue with a modified baseline.
   - Report to user which platform drifted and that the task was halted.
3. Only if check passes clean, report the task as complete.

**Why:** Guarded platforms (X, Threads, etc.) must never silently regress mid-task. The lock is only meaningful if enforcement runs after every edit, not just at build time.

**How to apply:** Treat `platform:check` as a mandatory post-edit step, equivalent to a required test.

## Pre-edit check (credit protection)
BEFORE starting any code-editing task:
1. Read `.stability-platforms.json` to list currently frozen files.
2. If the requested task clearly requires modifying any frozen file, STOP immediately and ask the user to unfreeze that platform first. Do not spend credits editing.
3. Only proceed with the task when no frozen files are in scope, or after the user unfreezes.

**Why:** Prevents wasting credits on work that would be auto-restored by the post-edit `platform:check`.