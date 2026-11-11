import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { GamNative } from "aelixto-gam-native";
import { referralFromInstallReferrer, referralFromUrl, rememberInvite, INVITE_REF_KEY } from "@/lib/inviteReferral";

const INSTALL_CHECK_KEY = "aelixto-install-invite-checked";

export function NativeInviteHandoff() {

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let removeListener: (() => void) | undefined;
    const acceptUrl = (url: string) => {
      const ref = referralFromUrl(url);
      if (ref) { rememberInvite(ref); }
    };
    (async () => {
      const listener = await App.addListener("appUrlOpen", ({ url }) => acceptUrl(url));
      if (disposed) { await listener.remove(); return; }
      removeListener = () => { void listener.remove(); };
      const launch = await App.getLaunchUrl();
      if (disposed) return;
      if (launch?.url) acceptUrl(launch.url);
      if (Capacitor.getPlatform() === "android" && !localStorage.getItem(INSTALL_CHECK_KEY)) {
        // Read independently of how the newly installed app was opened.
        const result = await GamNative.getInstallReferrer();
        if (disposed) return;
        const ref = referralFromInstallReferrer(result.referrer);
        if (ref && !localStorage.getItem(INVITE_REF_KEY)) rememberInvite(ref);
        localStorage.setItem(INSTALL_CHECK_KEY, "1");
      }
    })().catch(() => { /* unavailable native bridge: retry on next launch */ });
    return () => { disposed = true; removeListener?.(); };
  }, []);

  return null;
}
