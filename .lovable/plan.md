## Plan

1. **Make Home refresh work on the empty state**
   - Keep the same pull feel that is now working on Saved, Notifications, and Profile.
   - Adjust the Home empty-feed layout so the pull gesture has a full-height, touchable area instead of a short centered empty-state block.

2. **Protect the Home horizontal swipe from stealing vertical pulls**
   - Update `SwipeableView` so edge-swipe tracking is stricter and immediately releases vertical pulls.
   - This keeps Saved/Messages swipes working while letting Home pull-to-refresh win when the movement is downward.

3. **Keep refresh visibly held**
   - Do not change feed logic or unseen-post filtering.
   - Preserve the existing 1.2s spinner hold and loose pull thresholds.

4. **Verify the exact case from the screenshot**
   - Test Home when it shows “You’re all caught up”.
   - Confirm the spinner appears, holds briefly, refreshes, and glides back instead of flashing.