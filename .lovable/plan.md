## No changes to make

You confirmed this was just an explanation. Recap for reference:

**Debug APK** — `AD_TEST_MODE` and `AD_DEV_BYPASS_INSTALL_AGE` are both true (tied to Vite's `DEV` flag). Google test ad unit IDs are used, 48h install-age gate is skipped, ads appear after every 5 posts immediately. Not billable.

**Release APK / AAB** (`npm run build` → signed release) — both flags flip to false automatically. Live Ad Manager unit `/23362049225/aelixto_feed_native_android` + live app ID are used, 48h install-age gate enforced, ad every 5 posts, min 20s between requests, native only. Impressions/clicks billable in AdX.

**Prerequisite for release:** `android/app/src/main/AndroidManifest.xml` must contain:
```xml
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
           android:value="ca-app-pub-4944388830758437~6705238632"/>
```
Without it the Mobile Ads SDK crashes on init and no ads render. This file lives in the native Android project (after `npx cap add android`) and isn't in this repo.

No files will be modified. (99%)
