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
// Android 12+ icon: the system circle-masks EVERY splash icon. Without an icon
// background color the mask is a 192dp circle inside a 288dp box; a 128dp logo
// fits fully inside that circle (half-diagonal ≈ 91dp < 96dp), so it renders
// unclipped. An explicit 128dp layer-list item is independent of the icon box
// size (240dp/288dp varies by API level), and 128 CSS px = 128dp on Android,
// so the static logo is the exact same on-screen size as the pulsing HTML one.
// NOTE: never set windowSplashScreenIconBackgroundColor — it shrinks the mask
// to a 160dp circle and clips the logo's corners.
writeFileSync(
  join(res, "drawable", "splash_icon_blank.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item
        android:width="128dp"
        android:height="128dp"
        android:gravity="center"
        android:drawable="@drawable/splash_logo" />
</layer-list>
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
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`;

const styles = readFileSync(stylesPath, "utf8");
const pattern = /<style\s+name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/;
const next = pattern.test(styles)
  ? styles.replace(pattern, launchStyle)
  : styles.replace("</resources>", `    ${launchStyle}\n</resources>`);

// The white blink between the OS splash and the first WebView paint is the
// main theme's window background. Point it at the same logo frame so the gap
// is invisible instead of a flash of blank white.
let finalStyles = next;
const mainMatch = next.match(/<style\s+name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/);
if (mainMatch) {
  let mainStyle = mainMatch[0];
  if (/<item\s+name="android:windowBackground">/.test(mainStyle)) {
    mainStyle = mainStyle.replace(
      /<item\s+name="android:windowBackground">[^<]*<\/item>/,
      '<item name="android:windowBackground">@drawable/splash_blank</item>',
    );
  } else {
    mainStyle = mainStyle.replace(
      /(<style\s+name="AppTheme\.NoActionBar"[^>]*>)/,
      `$1\n        <item name="android:windowBackground">@drawable/splash_blank</item>`,
    );
  }
  finalStyles = next.replace(mainMatch[0], mainStyle);
}

writeFileSync(stylesPath, finalStyles);
console.log("[native-splash] Android launch screen set to match the HTML splash first frame");
