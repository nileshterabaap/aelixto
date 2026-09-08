import { Capacitor } from "@capacitor/core";

export async function openExternalUrl(url: string) {
  if (!url) return;

  if (Capacitor.isNativePlatform()) {
    try {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      await AppLauncher.openUrl({ url });
      return;
    } catch (e) {
      console.warn("External app launch failed", e);
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url, presentationStyle: "fullscreen" });
      } catch (browserError) {
        console.warn("External browser fallback failed", browserError);
      }
      return;
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}