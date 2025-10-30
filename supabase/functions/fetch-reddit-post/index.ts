import { corsHeaders } from '../_shared/cors.ts';

console.log('fetch-reddit-post function started');

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      throw new Error('URL is required');
    }

    console.log('[fetch-reddit-post] Fetching Reddit post:', url);

    // Convert Reddit URL to JSON API URL
    const jsonUrl = url.endsWith('/') ? `${url}.json` : `${url}.json`;
    
    // Fetch from Reddit's JSON API
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('[fetch-reddit-post] Successfully fetched Reddit data');

    // Extract post data from Reddit's response
    const post = data[0]?.data?.children?.[0]?.data;
    
    if (!post) {
      throw new Error('Could not parse Reddit post data');
    }

    // Return cleaned post data
    return new Response(
      JSON.stringify({
        title: post.title,
        author: post.author,
        subreddit: post.subreddit_name_prefixed,
        selftext: post.selftext,
        selftext_html: post.selftext_html,
        thumbnail: post.thumbnail !== 'self' && post.thumbnail !== 'default' ? post.thumbnail : null,
        url: post.url,
        permalink: `https://www.reddit.com${post.permalink}`,
        score: post.score,
        num_comments: post.num_comments,
        created_utc: post.created_utc,
        is_video: post.is_video,
        media: post.media,
        preview: post.preview,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[fetch-reddit-post] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
