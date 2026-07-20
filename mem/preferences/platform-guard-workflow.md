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