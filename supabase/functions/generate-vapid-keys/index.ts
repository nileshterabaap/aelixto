import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple VAPID key generator using Web Crypto API
async function generateVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const publicKeyBuffer = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  
  // Extract just the private key bytes (last 32 bytes of PKCS8)
  const privateKeyBytes = new Uint8Array(privateKeyBuffer).slice(-32);

  const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const privateKey = btoa(String.fromCharCode(...privateKeyBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return { publicKey, privateKey };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if VAPID keys already exist in app_settings table
    const { data: existingKeys } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vapid_public_key")
      .single();

    if (existingKeys?.value) {
      // Keys already exist, return the public key
      return new Response(
        JSON.stringify({ 
          publicKey: existingKeys.value,
          message: "VAPID keys already configured" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new VAPID keys
    const { publicKey, privateKey } = await generateVapidKeys();

    // Store keys in app_settings table
    await supabase.from("app_settings").upsert([
      { key: "vapid_public_key", value: publicKey },
      { key: "vapid_private_key", value: privateKey },
    ]);

    console.log("VAPID keys generated and stored successfully");

    return new Response(
      JSON.stringify({ 
        publicKey,
        message: "VAPID keys generated successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating VAPID keys:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
