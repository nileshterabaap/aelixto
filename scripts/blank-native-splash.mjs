#!/usr/bin/env node
// Makes Android's system launch screen a plain white screen (no logo), so the
// only splash the user sees is the animated HTML splash. Android 12+ always
// shows a system launch screen and cannot be skipped; blanking its icon is the
// closest possible to "removing" it. Idempotent; safe to run on every build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const res = join(process.cwd(), "android", "app", "src", "main", "res");
if (!existsSync(res)) {
  console.log("[blank-native-splash] no android/ folder — skipped");
  process.exit(0);
}

mkdirSync(join(res, "drawable"), { recursive: true });
writeFileSync(
  join(res, "drawable", "splash_blank.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFF" />
</shape>
`,
);
writeFileSync(
  join(res, "drawable", "splash_icon_blank.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@android:color/transparent" />
    <size android:width="1dp" android:height="1dp" />
</shape>
`,
);

const stylesPath = join(res, "values", "styles.xml");
if (!existsSync(stylesPath)) {
  console.warn("[blank-native-splash] styles.xml not found — skipped theme patch");
  process.exit(0);
}

const launchStyle = `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash_blank</item>
        <item name="windowSplashScreenBackground">#FFFFFF</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon_blank</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`;

const styles = readFileSync(stylesPath, "utf8");
const pattern = /<style\s+name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/;
const next = pattern.test(styles)
  ? styles.replace(pattern, launchStyle)
  : styles.replace("</resources>", `    ${launchStyle}\n</resources>`);

writeFileSync(stylesPath, next);
console.log("[blank-native-splash] Android launch screen set to plain white");
