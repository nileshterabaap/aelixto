import { checkInstagramReelAudio } from "../_shared/instagramAudio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only Instagram URLs are ever fetched.
    if (!/^https?:\/\/([^/]*\.)?instagram\.com\//i.test(url)) {
      return new Response(JSON.stringify({ error: "Only Instagram URLs are supported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await checkInstagramReelAudio(url);
    console.log(
      `[check-instagram-audio] url=${url} musicLibraryAudio=${result.musicLibraryAudio} song=${result.songName ?? "-"}`
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[check-instagram-audio] Error:", error);
    return new Response(
      JSON.stringify({ musicLibraryAudio: null, songName: null, artistName: null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
