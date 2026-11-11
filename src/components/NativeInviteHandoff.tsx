import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { GamNative } from "aelixto-gam-native";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { referralFromInstallReferrer, referralFromUrl, rememberInvite, INVITE_REF_KEY } from "@/lib/inviteReferral";

const INSTALL_CHECK_KEY = "aelixto-install-invite-checked";
const IOS_HANDOFF_KEY = "aelixto-ios-invite-handoff";

export function NativeInviteHandoff() {
  const [showPaste, setShowPaste] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let removeListener: (() => void) | undefined;
    const acceptUrl = (url: string) => {
      const ref = referralFromUrl(url);
      if (ref) { rememberInvite(ref); setShowPaste(false); }
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
      if (Capacitor.getPlatform() === "ios" && !localStorage.getItem(IOS_HANDOFF_KEY) && !localStorage.getItem(INVITE_REF_KEY)) {
        setShowPaste(true);
      }
    })().catch(() => { /* unavailable native bridge: retry on next launch */ });
    return () => { disposed = true; removeListener?.(); };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(IOS_HANDOFF_KEY, "1"); } catch { /* ignore */ }
    setShowPaste(false);
  };
  const paste = async () => {
    setBusy(true);
    try {
      const { url } = await GamNative.readInviteClipboard();
      const ref = referralFromUrl(url);
      if (!ref) { toast.error("No Aelixto invite found. Copy your friend's invite link and try again."); return; }
      rememberInvite(ref);
      dismiss();
    } catch { toast.error("Allow pasting to use your invitation, or open your friend's link again."); }
    finally { setBusy(false); }
  };

  return <AlertDialog open={showPaste}>
    <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>Invited by a friend?</AlertDialogTitle>
        <AlertDialogDescription>Paste the invite you copied before installing. When you create your account, you'll follow your friend automatically. Private accounts receive a follow request.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <Button variant="outline" disabled={busy} onClick={dismiss}>No invite</Button>
        <Button disabled={busy} onClick={paste}>{busy ? "Please wait…" : "Paste invite"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}