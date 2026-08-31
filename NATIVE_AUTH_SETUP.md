# Native Sign-In Setup (Google + Apple)

Aelixto now uses the **fully native** provider flows on device:

| Platform | Google | Apple |
|---|---|---|
| Android | Credential Manager bottom sheet | web flow (Apple has no Android SDK) |
| iOS | GoogleSignIn SDK sheet | `ASAuthorizationController` sheet |
| Web | managed broker popup | managed broker popup |

The native flows return an OIDC **ID token** which is exchanged in-process via
`supabase.auth.signInWithIdToken()` — no browser tab, no `~auth-bridge` hop.
If the client IDs below are missing, the app automatically falls back to the
previous Custom Tab / SFSafariViewController flow, so nothing breaks.

## 1. Google Cloud (console.cloud.google.com → APIs & Services → Credentials)

Create three OAuth client IDs in the **same project**:

1. **Web application** — copy its client ID into `VITE_GOOGLE_WEB_CLIENT_ID`.
   Credential Manager requires the *web* client ID (not the Android one).
2. **Android** — package `com.aelixto.app10`, plus the SHA-1 of BOTH your debug
   and release keystores (`keytool -list -v -keystore <keystore>`). Nothing to
   copy; it just has to exist.
3. **iOS** — bundle id `com.aelixto.app10`. Copy into `VITE_GOOGLE_IOS_CLIENT_ID`.

## 2. Apple Developer

- Enable **Sign in with Apple** on the App ID `com.aelixto.app10`.
- Create a **Services ID** + a **Sign in with Apple key (.p8)** (needed by the
  backend to validate tokens).
- In Xcode: Signing & Capabilities → **+ Capability → Sign in with Apple**.

## 3. Backend provider config (required)

Cloud → Users → Authentication Settings → Sign In Methods:
- **Google** → "use your own credentials" → paste the **web** client ID +
  secret, and add the **iOS** client ID to the authorized client IDs list.
- **Apple** → "use your own credentials" → Services ID + generated JWT secret.

Without this the ID tokens are rejected (`audience mismatch`).

## 4. Env vars (public identifiers, not secrets)

```
VITE_GOOGLE_WEB_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

## 5. Native rebuild

```
npm install
npx cap sync
```

iOS only: add the reversed iOS client ID as a URL scheme in `Info.plist`
(`com.googleusercontent.apps.xxxxx`).
