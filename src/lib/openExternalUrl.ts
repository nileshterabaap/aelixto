import { Capacitor } from "@capacitor/core";
// [SCORE-DIAG] Temporary diagnostic instrumentation (safe to delete with the
// scoreDiag import and its call sites below).
import { scoreDiag } from "@/hooks/useViewTracking";

export async function openExternalUrl(url: string) {
  if (!url) return;

  let host = "invalid";
  try { host = new URL(url).host; } catch { /* ignore */ }
  scoreDiag("open_external_called", { host, native: Capacitor.isNativePlatform() });

  if (Capacitor.isNativePlatform()) {
    try {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      await AppLauncher.openUrl({ url });
      scoreDiag("open_external_handoff", { host, via: "AppLauncher" });
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