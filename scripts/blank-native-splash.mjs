#!/usr/bin/env node
// Makes Android's system launch screen look exactly like the first frame of
// the animated HTML splash: the same logo (public/icon-1024.png), 128dp,
// centered on white. When the HTML splash takes over, the logo simply starts
// pulsing in place. Android 12+ always shows a system launch screen; matching
// it is the only way to make it invisible. Idempotent; run on every build.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const res = join(process.cwd(), "android", "app", "src", "main", "res");
if (!existsSync(res)) {
  console.log("[native-splash] no android/ folder — skipped");
  process.exit(0);
}

mkdirSync(join(res, "drawable"), { recursive: true });
mkdirSync(join(res, "drawable-nodpi"), { recursive: true });
copyFileSync(join(process.cwd(), "public", "icon-1024.png"), join(res, "drawable-nodpi", "splash_logo.png"));

// Pre-Android-12 window background: white + 128dp logo centered.
writeFileSync(
  join(res, "drawable", "splash_blank.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><shape android:shape="rectangle"><solid android:color="#FFFFFF" /></shape></item>
    <item android:width="128dp" android:height="128dp" android:gravity="center" android:drawable="@drawable/splash_logo" />
</layer-list>
`,
);
// Android 12+ icon: the system draws it in a 240dp box. The HTML splash logo
// is 128 CSS px, which on a typical phone (dpr ~3.5) is only ~37dp — so inset
// ~102dp per side to render the native icon at the same on-screen size,
// otherwise the first splash looks smaller than the pulsing one.
writeFileSync(
  join(res, "drawable", "splash_icon_blank.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/splash_logo"
    android:inset="102dp" />
`,
);

const stylesPath = join(res, "values", "styles.xml");
if (!existsSync(stylesPath)) {
  console.warn("[native-splash] styles.xml not found — skipped theme patch");
  process.exit(0);
}

const launchStyle = `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash_blank</item>
        <item name="windowSplashScreenBackground">#FFFFFF</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon_blank</item>
        <item name="windowSplashScreenIconBackgroundColor">#FFFFFF</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`;

const styles = readFileSync(stylesPath, "utf8");
const pattern = /<style\s+name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/;
const next = pattern.test(styles)
  ? styles.replace(pattern, launchStyle)
  : styles.replace("</resources>", `    ${launchStyle}\n</resources>`);

writeFileSync(stylesPath, next);
console.log("[native-splash] Android launch screen set to match the HTML splash first frame");
