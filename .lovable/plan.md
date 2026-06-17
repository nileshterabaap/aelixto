Plan:

1. Restore the pull-to-refresh waiting behavior
   - Update `PullToRefresh` so, after the thumb is lifted past the threshold, the spinner remains pinned at the loading position and spins until the refresh promise truly completes.
   - Add a short minimum visible loading duration so very fast RPC/cache responses cannot make it snap back instantly.

2. Prevent refresh from ending before the feed scan is meaningful
   - Adjust `useFollowingFeed.refresh()` so it does not immediately finish just because the first request returns quickly.
   - Keep the existing “scan a few times for newly created posts” behavior, but make its promise represent the full scan duration when needed.

3. Keep the current feed visible during refresh
   - Do not clear or replace feed data with an empty page during the scan.
   - Only atomically replace the first feed page after a valid fresh result is available, so pull-to-refresh cannot create a blank screen.

4. Validate the real interaction
   - Check that pulling past the threshold shows the spinner, lifting the thumb keeps it spinning, and it releases only after refresh work completes.
   - Confirm navigation-away/back is no longer required for newly fetched posts to appear.