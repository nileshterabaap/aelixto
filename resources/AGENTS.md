# Native icon/splash sources

- Android adaptive icon foreground (`icon-foreground.png`) is the full opaque icon, because `capacitor-assets` insets both adaptive layers 16.7% and any padded/tiled foreground renders as a tiny logo on the phone.
- `npm run assets:generate` calls `capacitor-assets` through `scripts/generate-native-assets.mjs` (arguments passed without a shell, Android and iOS run separately, any generation error fails the command), because quoted colour values in package.json broke icon generation on Windows.
