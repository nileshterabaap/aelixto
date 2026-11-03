import { Capacitor } from '@capacitor/core';

/**
 * Removes a delivered phone notification once its content is viewed.
 *
 * The push sender stamps every new-post and chat-message push with a
 * deterministic dismiss key (Android: FCM notification tag; iOS: APNs
 * `dismissKey` field). Calling this with the matching key clears that
 * notification from the phone's shade — same behavior as Instagram/WhatsApp.
 *
 * Fire-and-forget and web no-op; never throws.
 */

const dismissedThisSession = new Set<string>();

export const postNotificationKey = (postId: string) => `post-${postId.toLowerCase()}`;
export const chatNotificationKey = (conversationId: string) => `chat-${conversationId.toLowerCase()}`;

export const dismissNativeNotification = async (key: string): Promise<void> => {
  if (!key || dismissedThisSession.has(key)) return;
  if (!Capacitor.isNativePlatform()) return;
  dismissedThisSession.add(key);
  try {
    const { GamNative } = await import('aelixto-gam-native');
    await GamNative.dismissNotifications({ key });
  } catch {
    // Best-effort: an undelivered/stale notification may simply not exist.
  }
};

export const dismissPostNotification = (postId: string) =>
  dismissNativeNotification(postNotificationKey(postId));

export const dismissChatNotifications = (conversationId: string) =>
  dismissNativeNotification(chatNotificationKey(conversationId));
