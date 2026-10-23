import { supabase } from "@/integrations/supabase/client";

type GetUser = typeof supabase.auth.getUser;
type GetUserResult = Awaited<ReturnType<GetUser>>;

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
 * `getUser()` asks the server, so right after the phone wakes the app (or on a
 * flaky network) it can return no user even though the person is signed in.
 * Every action that calls it then failed with "Not authenticated" (most
 * visibly "Failed to create post"). This wraps it once, app-wide: when a local
 * session exists, renew it and retry before reporting the person signed out.
 * The database still verifies the session on every write.
 */
export const installAuthResilience = () => {
  if (installed) return;
  installed = true;

  const auth = supabase.auth as unknown as { getUser: GetUser };
  const original: GetUser = supabase.auth.getUser.bind(supabase.auth);

  auth.getUser = (async (jwt?: string) => {
    const first = await original(jwt);
    if (first.data.user || jwt) return first;

    const { data: local } = await supabase.auth.getSession();
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

    const expiresAt = (local.session.expires_at ?? 0) * 1000;
    if (isTransient(first.error) && expiresAt > Date.now()) {
      return { data: { user: local.session.user }, error: null } as GetUserResult;
    }
    return first;
  }) as GetUser;
};
