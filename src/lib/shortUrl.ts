import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/**
 * Generate a short shareable URL for an internal app path
 * (e.g. "/post/<id>" or "/u/<username>"). Falls back to the
 * long URL if the RPC fails for any reason.
 */
export async function buildShortUrl(path: string): Promise<string> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const longUrl = `${origin}${path}`;

  try {
    if (cache.has(path)) {
      return `${origin}/s/${cache.get(path)}`;
    }
    const { data, error } = await supabase.rpc("create_short_link", {
      p_target_path: path,
    });
    if (error || !data || typeof data !== "string") return longUrl;
    cache.set(path, data);
    return `${origin}/s/${data}`;
  } catch {
    return longUrl;
  }
}

export function buildPostPath(postId: string): string {
  return `/post/${postId}`;
}

export function buildProfilePath(username: string): string {
  return `/u/${username}`;
}
