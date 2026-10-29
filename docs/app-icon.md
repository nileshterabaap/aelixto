# App icon & splash (Android / iOS)

The Capacitor robot icon shows up whenever the native project still contains the
default template icons. Source images now live in `resources/`:

- `resources/icon-only.png` — 1024x1024 app icon (Aelixto mark on white)
- `resources/icon-foreground.png` / `resources/icon-background.png` — Android adaptive icon layers.
  The foreground must be the full, opaque `icon-only.png` (no extra padding or tile):
  the generator already insets both layers 16.7%, so any padding makes the logo tiny.
- `resources/splash.png`, `resources/splash-dark.png` — 2732x2732 launch screen

## Regenerate after every `git pull`

```bash
npm install
npm run build
npm run assets:generate      # writes mipmap/drawable icons into android/ and ios/
npx cap sync android
cd android
./gradlew clean bundleRelease
```

The filename `icon-only.png` is required by Capacitor's asset generator. The
command explicitly reads the `resources/` folder and overwrites
`android/app/src/main/res/mipmap-*/ic_launcher*.png`,
the adaptive icon XML, and the splash drawables — the files that currently hold
the Capacitor logo. Run it before building the AAB you upload to Play Console.

To change the logo, replace the files in `resources/` (same sizes) and re-run
`npm run assets:generate`.

## Icon not changing on the phone

Android launchers cache app icons. After installing a build with a new icon,
uninstall the old app first (or restart the phone), then install the new one.
