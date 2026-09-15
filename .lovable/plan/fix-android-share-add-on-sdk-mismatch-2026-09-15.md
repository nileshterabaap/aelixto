# Fix Android share add-on SDK mismatch

## What will change
- Keep the share-into-Aelixto feature.
- Move the installed `send-intent` add-on into the project as a local maintained copy.
- Change only that add-on's Android build settings to compile with SDK 36 while leaving target SDK 35 and minimum SDK 23 unchanged.
- Point the app dependency at the local copy so reinstalling packages or running Capacitor sync cannot restore the broken SDK 35 setting.
- Remove the obsolete `package` declaration from the ad add-on manifest if it remains in the tracked source.

## Verification
- Confirm the local add-on is discovered by Capacitor.
- Run the app checks and inspect the current build status.
- Provide the exact sync and Gradle commands to rerun on Windows.

## Not changing
- No share behavior, ads behavior, safe-area, keyboard, scoring, feed, or layout changes.
