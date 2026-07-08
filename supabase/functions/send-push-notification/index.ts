import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// FCM (Android) - OAuth2 JWT against Google service account
// ============================================================
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(input: ArrayBuffer | string): string {
  let bin: string;
  if (typeof input === "string") {
    bin = input;
  } else {
    const bytes = new Uint8Array(input);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    bin = s;
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

let fcmAccessTokenCache: { token: string; expiresAt: number } | null = null;
let fcmProjectIdCache: string | null = null;

async function getFcmAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  let sa: { client_email: string; private_key: string; project_id: string };
  try {
    sa = JSON.parse(raw);
  } catch {
    console.error("FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
  fcmProjectIdCache = sa.project_id;

  if (fcmAccessTokenCache && fcmAccessTokenCache.expiresAt > Date.now() + 60_000) {
    return { token: fcmAccessTokenCache.token, projectId: sa.project_id };
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const toSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, toSign);
  const jwt = `${headerB64}.${payloadB64}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    console.error("FCM token error", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  fcmAccessTokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return { token: json.access_token, projectId: sa.project_id };
}

async function sendFcm(
  deviceToken: string,
  title: string,
  body: string,
  url: string,
): Promise<{ ok: boolean; invalid: boolean }> {
  const auth = await getFcmAccessToken();
  if (!auth) return { ok: false, invalid: false };
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          data: { url },
          android: { priority: "HIGH", notification: { sound: "default" } },
        },
      }),
    },
  );
  if (res.ok) return { ok: true, invalid: false };
  const text = await res.text();
  console.error("FCM send error", res.status, text);
  const invalid =
    res.status === 404 ||
    res.status === 400 && /registration/i.test(text) ||
    /UNREGISTERED|INVALID_ARGUMENT/i.test(text);
  return { ok: false, invalid };
}

// ============================================================
// APNs (iOS) - JWT with ES256, .p8 key
// ============================================================
let apnsTokenCache: { token: string; issuedAt: number } | null = null;

async function getApnsJwt(): Promise<string | null> {
  const keyPem = Deno.env.get("APNS_AUTH_KEY");
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  if (!keyPem || !keyId || !teamId) return null;

  // APNs tokens valid up to 60 min; refresh after 50.
  if (apnsTokenCache && Date.now() - apnsTokenCache.issuedAt < 50 * 60 * 1000) {
    return apnsTokenCache.token;
  }

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: teamId, iat: now };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const toSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(keyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    toSign,
  );
  const jwt = `${headerB64}.${payloadB64}.${b64url(sig)}`;
  apnsTokenCache = { token: jwt, issuedAt: Date.now() };
  return jwt;
}

async function sendApns(
  deviceToken: string,
  title: string,
  body: string,
  url: string,
): Promise<{ ok: boolean; invalid: boolean }> {
  const jwt = await getApnsJwt();
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  if (!jwt || !bundleId) return { ok: false, invalid: false };

  const host = "https://api.push.apple.com"; // use api.sandbox.push.apple.com for dev builds
  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      Authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: "default",
        "mutable-content": 1,
      },
      url,
    }),
  });
  if (res.ok || res.status === 200) return { ok: true, invalid: false };
  const text = await res.text();
  console.error("APNs send error", res.status, text);
  const invalid = res.status === 410 || /BadDeviceToken|Unregistered/i.test(text);
  return { ok: false, invalid };
}

// Convert base64url to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Create JWT for VAPID
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const signatureInput = encoder.encode(`${headerB64}.${payloadB64}`);

  // Import private key
  const privateKeyBytes = urlBase64ToUint8Array(privateKeyBase64);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privateKeyBytes.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    signatureInput
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: only the service role (used by DB triggers) may invoke this function.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!token || !serviceKey || token !== serviceKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { userId, title, body, url, icon } = await req.json();

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: "userId and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ---------- Native push (FCM + APNs) ----------
    let nativeSent = 0;
    try {
      const { data: deviceTokens } = await supabase
        .from("device_tokens")
        .select("id, token, platform")
        .eq("user_id", userId);

      if (deviceTokens && deviceTokens.length) {
        for (const dt of deviceTokens) {
          const res =
            dt.platform === "android"
              ? await sendFcm(dt.token, title, body || "", url || "/")
              : await sendApns(dt.token, title, body || "", url || "/");
          if (res.ok) nativeSent++;
          else if (res.invalid) {
            await supabase.from("device_tokens").delete().eq("id", dt.id);
          }
        }
      }
    } catch (err) {
      console.error("Native push fan-out error:", err);
    }

    // Get VAPID keys from app_settings
    const { data: vapidPublic } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vapid_public_key")
      .single();

    const { data: vapidPrivate } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vapid_private_key")
      .single();

    if (!vapidPublic?.value || !vapidPrivate?.value) {
      // Web push not configured — that's fine if only native is in use.
      return new Response(
        JSON.stringify({ sent: nativeSent, native: nativeSent, web: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError || !subscriptions?.length) {
      console.log("No push subscriptions found for user:", userId);
      return new Response(
        JSON.stringify({ message: "No web subscriptions", sent: nativeSent, native: nativeSent, web: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      icon: icon || "/logo.png",
      url: url || "/",
      timestamp: Date.now(),
    });

    let successCount = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      try {
        const endpoint = new URL(sub.endpoint);
        const audience = `${endpoint.protocol}//${endpoint.host}`;
        
        const jwt = await createVapidJwt(
          audience,
          "mailto:support@aelixto.com",
          vapidPrivate.value
        );

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Authorization: `vapid t=${jwt}, k=${vapidPublic.value}`,
          },
          body: payload,
        });

        if (response.ok || response.status === 201) {
          successCount++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          console.log("Removed expired subscription:", sub.id);
        } else {
          errors.push(`Failed to send to ${sub.id}: ${response.status}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error sending to ${sub.id}: ${message}`);
      }
    }

    console.log(`Push notifications sent: web ${successCount}/${subscriptions.length}, native ${nativeSent}`);

    return new Response(
      JSON.stringify({ 
        sent: successCount + nativeSent,
        web: successCount,
        native: nativeSent,
        total: subscriptions.length,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending push notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
