/**
 * Android-only edge-to-edge enforcement.
 *
 * There is no JS API: the native plugin does its work in `load()`, which the
 * Capacitor bridge calls automatically for every plugin bundled into the app.
 * This file exists solely so the package is a valid npm/Capacitor plugin that
 * `npx cap sync android` can discover and re-link after the generated
 * `android/` folder is deleted or recreated.
 */
export {};
