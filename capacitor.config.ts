import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aelixto.app10',
  appName: 'Aelixto',
  webDir: 'dist',
  server: {
    cleartext: true,
    // Android System WebView advertises itself with "; wv" in the UA string.
    // Threads (and other Meta embeds) detect that token and serve a degraded
    // player shell whose poster/first-frame never loads — which is why the APK
    // shows a giant grey play placeholder while the same post renders fine in
    // Chrome. Overriding the UA with a plain Chrome-on-Android string makes the
    // embed serve the same markup it serves the website.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    overrideUserAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#FFFFFF",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // "LIGHT" = light status-bar background → dark icons/text (correct for our white header)
      style: "LIGHT",
      backgroundColor: "#00000000",
      // Edge-to-edge: the webview draws behind the system bars and the app
      // compensates with env(safe-area-inset-*) so every device (notch,
      // punch-hole, gesture bar, 3-button bar) fits correctly.
      overlaysWebView: true,
    },
    Keyboard: {
      // The WebView must NOT be resized by the soft keyboard. Android's
      // adjustResize combined with edge-to-edge produced stale viewport
      // heights (squashed auth form, blank message thread, composer floating
      // mid-screen). The app tracks the keyboard height itself via
      // `initKeyboardInsets()` and offsets layout with `--kb`.
      resize: "none" as never,
      resizeOnFullScreen: false,
    },
    SafeArea: {
      // Polyfills correct env(safe-area-inset-*) values on Android webviews
      // that report 0 in edge-to-edge mode.
      statusBarStyle: "LIGHT",
      navigationBarStyle: "LIGHT",
      detectViewportFitCoverChanges: true,
      initialViewportFitCover: true,
    },
  },
};

export default config;
