export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const USERNAME_RULE_HINT =
  "3-30 characters, starting with a letter. Letters, numbers, dots and underscores only.";

const USERNAME_SHAPE = /^[a-zA-Z][a-zA-Z0-9._]*$/;

export function isValidUsername(raw: string): boolean {
  const u = raw.trim();
  if (u.length < USERNAME_MIN_LENGTH || u.length > USERNAME_MAX_LENGTH) return false;
  if (!USERNAME_SHAPE.test(u)) return false;
  if (u.endsWith(".")) return false;
  return true;
}

export function usernameRuleError(raw: string): string | null {
  const u = raw.trim();
  if (!u) return "Username is required.";
  if (u.length < USERNAME_MIN_LENGTH) return "Username must be at least 3 characters.";
  if (u.length > USERNAME_MAX_LENGTH) return "Username must be at most 30 characters.";
  if (!USERNAME_SHAPE.test(u) || u.endsWith(".")) return null; // generic rule message
  return null;
}
