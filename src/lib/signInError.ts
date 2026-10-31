/**
 * Turns a failed password sign-in into one clear reason: the account doesn't
 * exist, the password is wrong, or the account uses Google/Apple sign-in.
 */
export type SignInMethod = "none" | "password" | "social" | null;

export function signInFailureMessage(opts: {
  /** true when the person typed a username (it was found, so the account exists) */
  viaUsername: boolean;
  /** what the server says about the email; null when the check itself failed */
  method: SignInMethod;
}): { title: string; description: string } {
  const { viaUsername, method } = opts;
  if (method === "none") {
    return { title: "Account not found", description: "No account found with this email." };
  }
  if (method === "social") {
    return {
      title: "Use Google or Apple",
      description: "This account was made with Google or Apple sign-in. Use that button below.",
    };
  }
  if (method === "password" || viaUsername) {
    return { title: "Incorrect password", description: "The password you entered is wrong. Please try again." };
  }
  return { title: "Sign in failed", description: "Couldn't check this email right now. Please try again." };
}

export function usernameNotFoundMessage(handle: string): { title: string; description: string } {
  return { title: "Account not found", description: `No account found with the username @${handle}.` };
}
