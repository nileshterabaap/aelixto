/**
 * Only a real "the person backed out" counts as a cancellation. "No
 * credentials available" is a failure (no usable Google account / Google
 * refused) and must be shown, not swallowed silently.
 */
export const isCancellation = (message: string) => {
  const m = message.toLowerCase();
  if (m.includes("no credential")) return false;
  return (
    m.includes("cancel") ||
    m.includes("dismiss") ||
    m.includes("user closed") ||
    m.includes("1001")
  );
};

/**
 * Android's standard Google picker sometimes reports "cancelled" even after an
 * account was picked. Retry exactly once through the One Tap sheet before
 * telling the person anything; never retry more than once.
 */
export const shouldRetryAndroidGoogle = (o: {
  platform: string;
  provider: "google" | "apple";
  cancelled: boolean;
  alreadyRetried: boolean;
}) => o.platform === "android" && o.provider === "google" && o.cancelled && !o.alreadyRetried;
