import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aelixto.app10',
  appName: 'Aelixto',
  webDir: 'dist',
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
    GoogleAuth: {
      // Web Client ID from Google Cloud Console (OAuth 2.0 → Web application).
      // NOTE: even on Android, GoogleAuth needs the WEB client ID, not the Android one.
      // Replace this placeholder with your actual Web Client ID.
      scopes: ["profile", "email"],
      serverClientId: "REPLACE_WITH_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
