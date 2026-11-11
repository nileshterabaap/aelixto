import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { toast } from "sonner";
import { inviteUrl } from "./inviteReferral";

export { INVITE_REF_KEY } from "./inviteReferral";

export function buildInviteText(username?: string | null): string {
  const link = username ? inviteUrl(username) : "https://aelixto.com";
  return `Found something interesting on Instagram, YouTube, TikTok or elsewhere? Share it on Aelixto and bring your favourite finds to a place made for them.

No algorithms deciding your feed — just content from people you choose to follow.

Come join me!

${link}`;
}

/** Opens the phone's full share sheet with the invite message. */
export async function shareInvite(username?: string | null) {
  const text = buildInviteText(username);
  try {
    if (Capacitor.isNativePlatform()) {
      // iOS lists apps like Instagram/WhatsApp only when a real link is
      // shared, so the link goes in `url` and the message stays in `text`.
      if (Capacitor.getPlatform() === "ios" && username) {
        const link = inviteUrl(username);
        await Share.share({ text: text.replace(link, "").trimEnd(), url: link, dialogTitle: "Let's Invite" });
      } else {
        await Share.share({ text, dialogTitle: "Let's Invite" });
      }
      return;
    }
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Invite copied — paste it anywhere");
  } catch {
    /* user closed the sheet */
  }
}
