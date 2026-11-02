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
