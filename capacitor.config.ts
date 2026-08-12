import type { CapacitorConfig } from '@capacitor/cli';

// DIAGNOSTIC ONLY — flip to false to disable in one line.
// When true, the Android WebView reports desktop Chrome's User-Agent instead
// of the default Android WebView UA (which contains "; wv" + Version/4.0).
const DEBUG_UA_OVERRIDE = true;

export const DEBUG_UA_STRING =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const config: CapacitorConfig = {
  appId: 'com.aelixto.app10',
  appName: 'Aelixto',
  webDir: 'dist',
  android: DEBUG_UA_OVERRIDE ? { overrideUserAgent: DEBUG_UA_STRING } : {},
  server: {
    cleartext: true,
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
