import { supabase } from "@/integrations/supabase/client";

type GetUser = typeof supabase.auth.getUser;
type GetUserResult = Awaited<ReturnType<GetUser>>;

/** A locally stored session this fresh is trusted without asking the server. */
const LOCAL_TRUST_MARGIN_MS = 60_000;

/** Errors that mean "couldn't reach the server", not "you are signed out". */
const isTransient = (error: GetUserResult["error"]) => {
  if (!error) return false;
  const status = (error as { status?: number }).status;
  return (
    error.name === "AuthRetryableFetchError" ||
    error.name === "AuthSessionMissingError" ||
    status === undefined ||
    status === 0 ||
    status >= 500
  );
};

let installed = false;

/**
 * `getUser()` asks the auth server every time. Dozens of screens call it just
 * to learn the signed-in person's id, so each call added a full network round
 * trip before the real request could start — slow on iPhone networks — and a
 * flaky moment after resume surfaced as "Not authenticated".
 *
 * Wrapped once, app-wide:
 * - a valid, unexpired local session answers immediately (the database still
 *   verifies the token on every read and write);
 * - otherwise ask the server, renewing the session and retrying before
 *   reporting the person signed out.
 */
export const installAuthResilience = () => {
  if (installed) return;
  installed = true;

  const auth = supabase.auth as unknown as { getUser: GetUser };
  const original: GetUser = supabase.auth.getUser.bind(supabase.auth);

  auth.getUser = (async (jwt?: string) => {
    if (jwt) return original(jwt);

    const { data: local } = await supabase.auth.getSession();
    const localExpiresAt = (local.session?.expires_at ?? 0) * 1000;
    if (local.session?.user && localExpiresAt - Date.now() > LOCAL_TRUST_MARGIN_MS) {
      return { data: { user: local.session.user }, error: null } as GetUserResult;
    }

    const first = await original();
    if (first.data.user) return first;
    if (!local.session) return first;

    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.user) {
        return { data: { user: refreshed.session.user }, error: null } as GetUserResult;
      }
    } catch {
      /* fall through to a plain retry */
    }

    const retry = await original();
    if (retry.data.user) return retry;

    if (isTransient(first.error) && localExpiresAt > Date.now()) {
      return { data: { user: local.session.user }, error: null } as GetUserResult;
    }
    return first;
  }) as GetUser;
};
