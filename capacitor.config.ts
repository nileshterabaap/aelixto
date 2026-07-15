import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aelixto.app10',
  appName: 'Aelixto',
  webDir: 'dist',
  server: {
    cleartext: true,
  },
  plugins: {
    AdMob: {
      // Google Ad Manager App IDs. Real IDs go here once the user pastes
      // them from Ad Manager -> Admin -> Apps. Placeholders keep the
      // native SDK from erroring during dev.
      appIdAndroid: 'ca-app-pub-3940256099942544~3347511713', // TEST
      appIdIos:     'ca-app-pub-3940256099942544~1458002511', // TEST
      requestTrackingAuthorization: true,
      initializeForTesting: true,
    },
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
