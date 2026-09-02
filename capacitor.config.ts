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
      backgroundColor: "#FFFFFF",
      overlaysWebView: false,
    },
  },
};

export default config;
