// Called by the client immediately after a report row is inserted. Fetches
// the report context, builds signed action URLs, and dispatches the moderator
// email via send-transactional-email.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SECRET = Deno.env.get('REPORT_ACTION_SECRET') || ''
const MODERATOR_EMAIL = Deno.env.get('MODERATOR_EMAIL') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL = 'https://aelixto.com'

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    if (!MODERATOR_EMAIL || !SECRET) {
      return new Response(JSON.stringify({ error: 'Moderation not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { reportId } = await req.json()
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'reportId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: report, error: rErr } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle()
    if (rErr || !report) throw new Error(rErr?.message || 'report not found')

    // Fetch reporter profile
    const { data: reporterProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', report.reporter_id)
      .maybeSingle()

    // Fetch reporter auth email
    let reporterEmail: string | undefined
    try {
      const { data: u } = await (supabase.auth as any).admin.getUserById(report.reporter_id)
      reporterEmail = u?.user?.email
    } catch (_) {
      /* ignore */
    }

    // Fetch post + author
    let post: any = null
    let reportedUsername: string | undefined
    if (report.target_post_id) {
      const { data: p } = await supabase
        .from('posts')
        .select('id, title, content, thumbnail_url, preview_image_url, platform, user_id')
        .eq('id', report.target_post_id)
        .maybeSingle()
      post = p
      if (p?.user_id) {
        const { data: authorProf } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', p.user_id)
          .maybeSingle()
        reportedUsername = authorProf?.username
      }
    } else if (report.target_user_id) {
      const { data: authorProf } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', report.target_user_id)
        .maybeSingle()
      reportedUsername = authorProf?.username
    }

    const fnBase = `${SUPABASE_URL}/functions/v1/moderate-report`
    const sigDelete = await hmac(`${reportId}:delete`)
    const sigKeep = await hmac(`${reportId}:keep`)
    const deleteUrl = `${fnBase}?r=${reportId}&a=delete&s=${sigDelete}`
    const keepUrl = `${fnBase}?r=${reportId}&a=keep&s=${sigKeep}`
    const postUrl = post?.id ? `${SITE_URL}/post/${post.id}` : undefined

    const { error: sendErr } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'report-alert',
        recipientEmail: MODERATOR_EMAIL,
        idempotencyKey: `report-${reportId}`,
        templateData: {
          reporterUsername: reporterProfile?.username || 'unknown',
          reporterEmail,
          reportedUsername: reportedUsername || 'unknown',
          reason: report.reason,
          details: report.details,
          postCaption: post?.title || post?.content || '',
          postThumbnail: post?.thumbnail_url || post?.preview_image_url || '',
          postUrl,
          platform: post?.platform || '',
          reportId,
          deleteUrl,
          keepUrl,
          reviewUrl: postUrl,
        },
      },
    })
    if (sendErr) throw sendErr

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('notify-report error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})