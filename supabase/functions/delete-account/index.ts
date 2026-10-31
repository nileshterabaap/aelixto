// Permanently deletes the signed-in person's account and everything they
// created: posts, likes, comments, follows, chats, uploaded photos, device
// registrations, and finally the sign-in account itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// [table, column] pairs holding rows that belong to (or point at) the user.
const USER_ROWS: Array<[string, string]> = [
  ["likes", "user_id"],
  ["saves", "user_id"],
  ["reposts", "user_id"],
  ["comments", "user_id"],
  ["follows", "follower_id"],
  ["follows", "following_id"],
  ["follow_requests", "requester_id"],
  ["follow_requests", "target_id"],
  ["blocked_users", "user_id"],
  ["blocked_users", "blocked_user_id"],
  ["hidden_users", "user_id"],
  ["hidden_users", "hidden_user_id"],
  ["muted_users", "user_id"],
  ["muted_users", "muted_user_id"],
  ["hidden_posts", "user_id"],
  ["post_seen", "user_id"],
  ["post_views", "viewer_id"],
  ["notifications", "recipient_id"],
  ["notifications", "actor_id"],
  ["reports", "reporter_id"],
  ["post_drafts", "user_id"],
  ["connected_socials", "user_id"],
  ["device_tokens", "user_id"],
  ["push_subscriptions", "user_id"],
  ["install_metadata", "user_id"],
  ["play_debug_sessions", "user_id"],
  ["posts", "user_id"],
  ["profiles", "user_id"],
];

const UPLOAD_BUCKETS = ["avatars", "covers", "posts"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const uid = userData?.user?.id;
  if (userErr || !uid) return json({ error: "Not signed in" }, 401);

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  if (body.confirm !== "DELETE") return json({ error: "Confirmation missing" }, 400);

  const fail = (step: string, err: unknown) => {
    console.error(`[delete-account] ${uid} failed at ${step}:`, err);
    return json({ error: "Could not delete your account. Please try again." }, 500);
  };

  // 1. Uploaded photos/videos live in "<user id>/..." folders.
  for (const bucket of UPLOAD_BUCKETS) {
    for (let round = 0; round < 50; round++) {
      const { data: files, error } = await admin.storage.from(bucket).list(uid, { limit: 1000 });
      if (error) return fail(`list ${bucket}`, error);
      if (!files?.length) break;
      const paths = files.filter((f) => f.name).map((f) => `${uid}/${f.name}`);
      if (!paths.length) break;
      const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
      if (rmErr) return fail(`remove ${bucket}`, rmErr);
      if (files.length < 1000) break;
    }
  }

  // 2. Chats the person was in (messages and participants go with them).
  const { data: parts, error: partsErr } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", uid);
  if (partsErr) return fail("load chats", partsErr);
  const convIds = [...new Set((parts || []).map((p) => p.conversation_id))];
  for (let i = 0; i < convIds.length; i += 200) {
    const { error } = await admin.from("conversations").delete().in("id", convIds.slice(i, i + 200));
    if (error) return fail("delete chats", error);
  }
  {
    const { error } = await admin.from("messages").delete().eq("sender_id", uid);
    if (error) return fail("delete messages", error);
  }

  // 3. Collections and their items.
  const { data: cols, error: colsErr } = await admin.from("collections").select("id").eq("user_id", uid);
  if (colsErr) return fail("load collections", colsErr);
  const colIds = (cols || []).map((c) => c.id);
  if (colIds.length) {
    const { error } = await admin.from("collection_items").delete().in("collection_id", colIds);
    if (error) return fail("delete collection items", error);
  }
  {
    const { error } = await admin.from("collections").delete().eq("user_id", uid);
    if (error) return fail("delete collections", error);
  }

  // 4. Everything else tied to the person.
  for (const [table, column] of USER_ROWS) {
    const { error } = await admin.from(table).delete().eq(column, uid);
    if (error) return fail(`${table}.${column}`, error);
  }

  // 5. The sign-in account itself (also removes their roles).
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return fail("auth user", delErr);

  console.log(`[delete-account] deleted ${uid}`);
  return json({ ok: true });
});
