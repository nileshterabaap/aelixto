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
      return;
    }
  }

  window.open(url, "_blank", "noopener,noreferrer");
}