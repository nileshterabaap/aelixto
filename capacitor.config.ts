import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aelixto.app10',
  appName: 'Aelixto',
  webDir: 'dist',
  server: {
    cleartext: true,
    // Keep allowed external auth/social pages inside the WebView while the app
    // itself loads from the freshly synced local `dist` bundle.
    allowNavigation: [
      "aelixto.com",
      "*.aelixto.com",
      "*.lovable.app",
      "oauth.lovable.app",
      "*.lovableproject.com",
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com",
      "appleid.apple.com",
      "*.apple.com",
      "*.supabase.co"
    ]
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
      style: "DARK",
      backgroundColor: "#FFFFFF",
    },
  },
};

export default config;
