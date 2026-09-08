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
    // NOTE: no `StatusBar` block on purpose. @capacitor-community/safe-area
    // owns edge-to-edge and the system bars; @capacitor/status-bar's
    // `overlaysWebView` fights with it and makes the webview draw behind the
    // bars WITHOUT any inset compensation (content clipped at top/bottom on
    // devices whose WebView reports env(safe-area-inset-*) as 0).

    // NOTE: no `Keyboard` block on purpose — this restores the pre-September
    // behaviour where Android natively resizes the WebView for the soft
    // keyboard. The visible viewport then ends exactly at the top of the
    // keyboard, so the app does no keyboard math at all (`--kb` stays 0) and
    // no white band can appear under the composer.
    // Capacitor 8 ships a built-in SystemBars plugin that also applies insets.
    // Disable its inset handling so @capacitor-community/safe-area is the only
    // owner of Android inset handling (per the safe-area docs).
    SystemBars: {
      insetsHandling: "disable",
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
